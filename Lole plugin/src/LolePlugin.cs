namespace Loupedeck.LolePlugin
{
    using System;

    // This class contains the plugin-level logic of the Loupedeck plugin.
    public class LolePlugin : Plugin
    {
        // Gets a value indicating whether this is an API-only plugin.
        public override Boolean UsesApplicationApiOnly => true;

        // Gets a value indicating whether this is a Universal plugin or an Application plugin.
        public override Boolean HasNoApplication => true;

        // Initializes a new instance of the plugin class.
        public LolePlugin()
        {
            // Initialize the plugin log.
            PluginLog.Init(this.Log);

            // Initialize the plugin resources.
            PluginResources.Init(this.Assembly);
        }

        // This method is called when the plugin is loaded.
        public override void Load()
        {
            this.OnPluginStatusChanged(Loupedeck.PluginStatus.Warning, "The chrome extension is an integral part of the project. " +
                "Make sure to download the extension zipped file from the GitHub (mentioned in the readme)");

            _ = WebService.Instance.StartAsync();

            // will run after the webserver gets the "ping" request from the extension
            WebService.Instance.OnExtensionInstalled += (sender, path) =>
            {
                this.OnPluginStatusChanged(Loupedeck.PluginStatus.Normal, "Extension linked! All actions are now active.");

                this.SetPluginSetting("TargetChromeProfile", path);
                PluginLog.Info($"Successfully linked and saved Chrome Profile: {path}");
            };

            // Define the base path once to keep things clean
            string userProfilePath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

            string keypadPath = Path.Combine(userProfilePath, "Lole_keypad_profile.lp5");
            string dialpadPath = Path.Combine(userProfilePath, "Lole_dialpad_profile.lp5");

            // Download keypad profile if missing
            if (!System.IO.File.Exists(keypadPath))
            {
                _ = WebService.DownloadFileAsync("https://hackathonmaverick.in/Lole_keypad_profile.lp5", keypadPath);
            }

            // Download diaplpad profile if missing
            if (!System.IO.File.Exists(dialpadPath))
            {
                _ = WebService.DownloadFileAsync("https://hackathonmaverick.in/Lole_dialpad_profile.lp5", dialpadPath);
            }
        }

        // This method is called when the plugin is unloaded.
        public override void Unload()
        {
            WebService.Instance.Dispose();
            this.DeletePluginSetting("TargetChromeProfile");
        }
    }
}
