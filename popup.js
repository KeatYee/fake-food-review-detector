// FoodTrust Settings Popup

class FoodTrustSettings {
  constructor() {
    this.enableToggle = document.getElementById("enableToggle");
    this.statusInfo = document.getElementById("statusInfo");
    this.statusIndicator = document.getElementById("statusIndicator");
    this.statusText = document.getElementById("statusText");

    this.init();
  }

  async init() {
    // Load current settings
    await this.loadSettings();

    // Bind events
    this.enableToggle.addEventListener("change", () =>
      this.handleToggleChange()
    );

    // Update status
    this.updateStatus();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(["foodtrustEnabled"]);
      const isEnabled = result.foodtrustEnabled !== false; // Default to true
      this.enableToggle.checked = isEnabled;
    } catch (error) {
      console.error("Error loading settings:", error);
      this.enableToggle.checked = true; // Default to enabled
    }
  }

  async handleToggleChange() {
    const isEnabled = this.enableToggle.checked;

    try {
      // Save setting
      await chrome.storage.local.set({ foodtrustEnabled: isEnabled });

      // Update status
      this.updateStatus();

      // Notify content scripts about the change
      await this.notifyContentScripts(isEnabled);
    } catch (error) {
      console.error("Error saving settings:", error);
      // Revert toggle on error
      this.enableToggle.checked = !isEnabled;
    }
  }

  updateStatus() {
    const isEnabled = this.enableToggle.checked;

    if (isEnabled) {
      this.statusInfo.classList.remove("inactive");
      this.statusIndicator.classList.remove("inactive");
      this.statusText.textContent = "Active on Google Maps";
    } else {
      this.statusInfo.classList.add("inactive");
      this.statusIndicator.classList.add("inactive");
      this.statusText.textContent = "Disabled";
    }
  }

  async notifyContentScripts(isEnabled) {
    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({});

      // Notify all Google Maps tabs
      for (const tab of tabs) {
        if (tab.url && tab.url.includes("google.com/maps")) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: "toggleFoodTrust",
              enabled: isEnabled,
            });
          } catch (error) {
            // Tab might not have content script loaded, ignore
            console.log("Could not notify tab:", tab.id);
          }
        }
      }
    } catch (error) {
      console.error("Error notifying content scripts:", error);
    }
  }
}

// Initialize settings when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FoodTrustSettings();
});
