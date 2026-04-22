namespace Loupedeck.LolePlugin
{
    using System;
    using System.Threading.Tasks;

    /* ==========================================
    BASE CLASS (Handles Chrome Focus for everyone)
    =========================================== */
    public abstract class LoLeBaseCommand : PluginDynamicCommand
    {
        // Default is true, meaning commands will focus Chrome unless they say otherwise
        protected virtual bool RequiresFocus => true;

        // Sets up the straightforward button in the UI
        public LoLeBaseCommand(string displayName, string description, string groupName)
            : base(displayName, description, groupName)
        {
        }

        // This runs automatically when ANY of the keypad buttons are pressed
        protected override async void RunCommand(String actionParameter)
        {
            PluginLog.Info($"Executing LoLé Command: {this.Name}");

            // Only run the focus/launch logic if the specific button requires it
            if (this.RequiresFocus)
            {
                if (WebService.Instance.IsClientConnected)
                {
                    _ = WebService.Instance.SendAsync("{ \"type\": \"FOCUS_BROWSER\" }");
                    await Task.Delay(300);
                }
                else
                {
                    this.Plugin.TryGetPluginSetting("TargetChromeProfile", out string savedProfilePath);
                    if (string.IsNullOrEmpty(savedProfilePath))
                        savedProfilePath = "Default";

                    ChromeAccountAPI.LaunchProfile(savedProfilePath);
                    await Task.Delay(1200);
                }
            }

            // Always fire the action
            this.ExecuteAction();
        }

        // Each specific button will run its own action
        protected abstract void ExecuteAction();
    }


    /* ====================
       Keypad button actions
    ======================= */

    // Button #01: Deep Clean
    public class DeepCleanCommand : LoLeBaseCommand
    {
        public DeepCleanCommand() : base("Deep Clean", "Runs system deep clean & remove temporary files", "LoLé Commands (24)###Windows OS Actions (6)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            try
            {
                // Run the cleaner directly from the command
                CleanResult cleanStats = SystemCleanerAPI.ExecuteDeepClean();

                // Show native Windows success toast
                NotificationHelper.ShowToast("✅ Deep Clean completed", cleanStats.Summary);
            }
            catch (Exception ex)
            {
                // Show native Windows error toast
                string errorMessage = string.IsNullOrEmpty(ex.Message)
                    ? "Ran into some issues while calling the Deep Clean method from Logi Plugin"
                    : ex.Message;

                NotificationHelper.ShowToast("🚫 Errors in doing deep clean", errorMessage);
            }
        }
    }

    // Button #02: Rename Logi CLI
    public class RenameLogiCommand : LoLeBaseCommand
    {
        public RenameLogiCommand() : base("Rename Logi CLI Tool", "Toggles Logi Plugin CLI tool name, for faster & easy access", "LoLé Commands (24)###Windows OS Actions (6)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            ToolRenameResult renameData = LogiPluginToolAPI.RenameTool();

            if (renameData.success)
            {
                // Get directory and format as URI
                string folderPath = System.IO.Path.GetDirectoryName(renameData.filePath);
                string folderUri = $"file:///{folderPath.Replace("\\", "/")}";

                // Success Toast with clickable button
                //NotificationHelper.ShowToast("✅ CLI Tool Renamed", renameData.message, folderUri);
                NotificationHelper.ShowToast("✅ CLI Tool Renamed", renameData.message, folderPath);
            }
            else
            {
                // Error Toast
                NotificationHelper.ShowToast("🚫 Rename Failed", renameData.message);
            }
        }
    }

    // Button #03: Gmail Profiles
    public class GmailProfileCommand : LoLeBaseCommand
    {
        public GmailProfileCommand() : base("Gmail Profiles", "Fetches Chrome profiles & emails with just a click", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends JSON message directly to your background script
            _ = WebService.Instance.SendAsync("{ \"type\": \"GET_CHROME_PROFILES\" }");
        }
    }

    // Button #04: Call Extension
    public class CallExtensionCommand : LoLeBaseCommand
    {
        public CallExtensionCommand() : base("Call Extension", "Open the project landing page or do some webpage tricks", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            ChromeWindowManagerAPI.SendCtrlShiftShortcut(' ');
        }
    }

    // Button #05: Entire page screenshot
    public class fullPageSnipCommand : LoLeBaseCommand
    {
        public fullPageSnipCommand() : base("Full Snip", "Take a full-webpage snip & download image", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"FULL_PAGE_SNIP\" }");
        }
    }

    // Button #06: Custom-page screenshot
    public class customPageSnipCommand : LoLeBaseCommand
    {
        public customPageSnipCommand() : base("Custom Snip", "Snip out any Chrome webpage & get the image", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"CUSTOM_PAGE_SNIP\" }");
        }
    }

    // Button #07: Open notes
    public class openNotesCommand : LoLeBaseCommand
    {
        public openNotesCommand() : base("Open Notes", "Go to the notes webpage & write down anything", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"OPEN_NOTES\" }");
        }
    }

    // Button #08: Jump to first tab
    public class jumpToFirstTabCommand : LoLeBaseCommand
    {
        public jumpToFirstTabCommand() : base("Jump to first tab", "Go to the first opened tab of the browser", "LoLé Commands (24)###Chrome browser actions (18)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            ChromeWindowManagerAPI.SendCtrlShiftShortcut('1', false);
        }
    }

    // Button #09: Jump to first tab
    public class jumpToLastTabCommand : LoLeBaseCommand
    {
        public jumpToLastTabCommand() : base("Jump to last tab", "Go to the last opened tab of the browser", "LoLé Commands (24)###Chrome browser actions (18)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            ChromeWindowManagerAPI.SendCtrlShiftShortcut('9', false);
        }
    }


    // Button #10: Search Tabs
    public class searchTabsCommand : LoLeBaseCommand
    {
        public searchTabsCommand() : base("Search Tabs", "Search any specific tabs from the tab-pool", "LoLé Commands (24)###Chrome browser actions (18)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            ChromeWindowManagerAPI.SendCtrlShiftShortcut('A');
        }
    }

    // Button #11: Toggle pin the tab
    public class togglePinTabCommand : LoLeBaseCommand
    {
        public togglePinTabCommand() : base("Pin/unpin the tab", "Pin/unpin a browser tab", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"TOGGLE_PIN\" }");
        }
    }

    // Button #12: Move to the recent tab
    public class moveToRecentTabCommand : LoLeBaseCommand
    {
        public moveToRecentTabCommand() : base("Open recent tab", "Switch to the recent Chrome tab", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"OPEN_RECENT_TAB\" }");
        }
    }


    // Button #13: Save notes
    public class SaveNotesCommand : LoLeBaseCommand
    {
        public SaveNotesCommand() : base("Save Notes", "With a tap, save the notes in an encrypted manner", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"SAVE_NOTES\" }");
        }
    }

    // Button #14: Edit notes
    public class EditNotesCommand : LoLeBaseCommand
    {
        public EditNotesCommand() : base("Edit Notes", "Quickly edit your saved notes on the web", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"EDIT_NOTES\" }");
        }
    }

    // Button #15: OPEN_SINGLE_PAGE_BOOKMARKS
    public class OpenSinglePageBookmarksCommand : LoLeBaseCommand
    {
        public OpenSinglePageBookmarksCommand() : base("Open bookmarks", "Open all single-page bookmarks in a click & in a grouped manner", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"OPEN_SINGLE_PAGE_BOOKMARKS\" }");
        }
    }

    // Button #16: LOGI_OVERLAY
    public class LogiOverlayCommand : LoLeBaseCommand
    {
        public LogiOverlayCommand() : base("Logi Overlay", "Open the logitech overlay after 1-minute of web inactivity", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            // Sends the physical keyboard shortcut to trigger the extension UI popup
            _ = WebService.Instance.SendAsync("{ \"type\": \"LOGI_OVERLAY\" }");
        }
    }

    // Button #17: FOCUS_MODE
    public class FocusCommand : LoLeBaseCommand
    {
        public FocusCommand() : base("Focus Mode", "Grab the opened Logitech websites & group them to be more productive", "LoLé Commands (24)###Chrome browser actions (18)###Extension based actions (12)") { }

        protected override void ExecuteAction()
        {
            _ = WebService.Instance.SendAsync("{ \"type\": \"FOCUS_MODE\" }");
        }
    }

    /* ===================
    Dialpad button actions 
    =================== */
    // Button #18: The Resurrection Key (Ctrl + Shift + T)
    public class ReopenTabCommand : LoLeBaseCommand
    {
        public ReopenTabCommand() : base("Reopen Closed Tab", "Restores the last closed Chrome tab", "LoLé Commands (24)###Chrome browser actions (18)") { }

        // Defaults to RequiresFocus = true, so Chrome guarantees it's front-and-center
        protected override void ExecuteAction()
        {
            ChromeWindowManagerAPI.SendShortcut((byte)'T', ctrl: true, shift: true);
        }
    }

    // Button #19: Hard Refresh (Ctrl + F5)
    public class HardReloadCommand : LoLeBaseCommand
    {
        public HardReloadCommand() : base("Hard Reload", "Clears cache and force reloads the webpage", "LoLé Commands (24)###Chrome browser actions (18)") { }

        // Stop the base class from aggressively launching Chrome
        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            // Only fire the shortcut if Chrome is actually running in the background
            if (System.Diagnostics.Process.GetProcessesByName("chrome").Length > 0)
            {
                ChromeWindowManagerAPI.SendShortcut(ChromeWindowManagerAPI.VK_F5, ctrl: true);
            }
        }
    }

    // Button #20: The inspector (F12)
    public class ToggleDevToolsCommand : LoLeBaseCommand
    {
        public ToggleDevToolsCommand() : base("Toggle DevTools", "Opens/closes Chrome inspector/dev tools", "LoLé Commands (24)###Chrome browser actions (18)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            if (System.Diagnostics.Process.GetProcessesByName("chrome").Length > 0)
            {
                ChromeWindowManagerAPI.SendShortcut(ChromeWindowManagerAPI.VK_F12);
            }
        }
    }

    // Button #21: The Context Switcher (Alt + Tab)
    public class AppSwitcherCommand : LoLeBaseCommand
    {
        public AppSwitcherCommand() : base("App Switcher", "Quickly switch between two apps", "LoLé Commands (24)###Windows OS Actions (6)") { }

        // THE FIX: Set to false! We DO NOT want to pull Chrome forward first, 
        // we just want to fire Alt+Tab instantly to let the OS flip windows.
        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            ChromeWindowManagerAPI.SendShortcut(ChromeWindowManagerAPI.VK_TAB, alt: true);
        }
    }

    // Button #22: The Toggle Button (Minimize All & Hide Icons)
    public class ToggleDesktopCommand : LoLeBaseCommand
    {
        public ToggleDesktopCommand() : base("Toggle Desktop", "Hide/unhide the desktop icons", "LoLé Commands (24)###Windows OS Actions (6)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            ChromeWindowManagerAPI.ToggleDesktopIcons();
        }
    }

    // Button #23: The Arranger Button (Sorts & Organizes Icons)
    public class ArrangeDesktopCommand : LoLeBaseCommand
    {
        public ArrangeDesktopCommand() : base("Desktop Island", "Turn your desktop into an icon-island", "LoLé Commands (24)###Windows OS Actions (6)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            ChromeWindowManagerAPI.ShowDesktop();

            IntPtr handle = DesktopIconManager.GetDesktopListViewHandle();
            if (handle != IntPtr.Zero)
            {
                DesktopIconManager.ArrangeIcons(handle);
            }
        }
    }

    // Button #24: The Restorer Button (Reverts to original layout)
    public class RestoreDesktopCommand : LoLeBaseCommand
    {
        public RestoreDesktopCommand() : base("Restore Desktop", "Reverts icons to their original custom layout", "LoLé Commands (24)###Windows OS Actions (6)") { }

        protected override bool RequiresFocus => false;

        protected override void ExecuteAction()
        {
            ChromeWindowManagerAPI.ShowDesktop();

            IntPtr handle = DesktopIconManager.GetDesktopListViewHandle();
            if (handle != IntPtr.Zero)
            {
                DesktopIconManager.RestoreLayout(handle);
            }
        }
    }
}