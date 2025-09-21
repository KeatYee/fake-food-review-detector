import json
import joblib
import boto3
import os
import numpy as np  # <-- Added numpy for confidence calculation

# =======================================================================
# S3 Paths and Model Loading
# =======================================================================
S3_BUCKET_NAME = "fake-review-dataset-penguining"
MODEL_KEY = "model/model_pipeline.joblib"
LOCAL_MODEL_PATH = f"/tmp/model.joblib"

s3 = boto3.client('s3')
model = None

try:
    print("Loading scikit-learn model from S3...")
    s3.download_file(S3_BUCKET_NAME, MODEL_KEY, LOCAL_MODEL_PATH)
    model = joblib.load(LOCAL_MODEL_PATH)
    print("Scikit-learn model loaded successfully.")
except Exception as e:
    print(f"FATAL: Could not load scikit-learn model. Error: {e}")

# =======================================================================
# Bedrock Client Initialization (us-east-1, Titan Express)
# =======================================================================
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
BEDROCK_MODEL_ID = "amazon.titan-text-express-v1"

# =======================================================================
# Lambda Handler for Batch Processing with Titan and Confidence
# =======================================================================
def lambda_handler(event, context):
    if model is None:
        return {'statusCode': 500, 'body': json.dumps({'error': 'Model is not loaded.'})}

    try:
        body = json.loads(event.get('body', '{}'))
        reviews_list = body.get('reviews')

        if not reviews_list or not isinstance(reviews_list, list):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Request body must contain a "reviews" array.'})
            }

        texts_to_predict = [review.get('review_text', '') for review in reviews_list]
        
        # Get both predictions and probabilities from the scikit-learn model
        predictions = model.predict(texts_to_predict)
        probabilities = model.predict_proba(texts_to_predict)  # <-- Added this line
        
        final_results = []
        
        for i, prediction_result in enumerate(predictions):
            label = "Fake" if prediction_result == 1 else "Real"
            review_text = texts_to_predict[i]
            
            # Get the confidence score for this specific prediction
            confidence = np.max(probabilities[i])  # <-- Added this line
            
            reason_category = "N/A"
            reason_description = "This review appears to be genuine."

            if prediction_result == 1:
                prompt = f"""You are an expert at detecting inauthentic online reviews. The following review has been flagged as potentially fake by a machine learning model.
                Analyze the review and provide a concise, one-sentence reason for why it is suspicious. Categorize your reason into one of the following: 'AI-Generated Language', 'Promotional Spam', or 'Generic/Unhelpful'.
                
                Review: "{review_text}"
                
                Respond ONLY with a valid JSON object with "reason_category" and "reason_description" keys."""

                bedrock_request_body = {
                    "inputText": prompt,
                    "textGenerationConfig": { "maxTokenCount": 150, "temperature": 0.7, "stopSequences": [] }
                }
                
                response = bedrock.invoke_model(body=json.dumps(bedrock_request_body), modelId=BEDROCK_MODEL_ID)
                response_body_str = response['body'].read().decode('utf-8')
                bedrock_result = json.loads(response_body_str)['results'][0]['outputText']
                
                # Robust JSON parsing
                explanation = {}
                if '{' in bedrock_result and '}' in bedrock_result:
                    try:
                        start_index = bedrock_result.find('{')
                        end_index = bedrock_result.rfind('}') + 1
                        json_str = bedrock_result[start_index:end_index]
                        explanation = json.loads(json_str)
                    except json.JSONDecodeError:
                        explanation['reason_category'] = 'General Analysis'
                        explanation['reason_description'] = bedrock_result.strip()
                else:
                    explanation['reason_category'] = 'General Analysis'
                    explanation['reason_description'] = bedrock_result.strip()

                reason_category = explanation.get('reason_category', 'Analysis Failed')
                reason_description = explanation.get('reason_description', 'Could not generate a reason.')
            
            final_results.append({
                'predicted_label': label,
                'is_fake': int(prediction_result),
                'confidence': f"{confidence:.4f}",  # <-- Added this line
                'reason_category': reason_category,
                'reason_description': reason_description
            })

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(final_results)
        }

    except Exception as e:
        print(f"Error: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Could not process the request.'})}