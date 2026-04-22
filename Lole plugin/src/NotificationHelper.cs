namespace Loupedeck.LolePlugin
{
    using System.Diagnostics;

    public static class NotificationHelper
    {
        // Use this for simple 2-line messages
        public static void ShowToast(string title, string message)
        {
            title = title?.Replace("'", "''") ?? "";
            message = message?.Replace("'", "''") ?? "";

            string psCommand = $@"
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
                $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
                $text = $template.GetElementsByTagName('text');
                $text.Item(0).AppendChild($template.CreateTextNode('{title}')) | Out-Null;
                $text.Item(1).AppendChild($template.CreateTextNode('{message}')) | Out-Null;
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('LogiPlugin').Show($template);
            ";
            RunPowerShell(psCommand);
        }

        // Use this for 3-line messages with a location
        public static void ShowToast(string title, string message, string location)
        {
            // 1. Escape quotes for safe PowerShell injection
            title = title?.Replace("'", "''") ?? "";
            message = message?.Replace("'", "''") ?? "";
            string displayLocation = location?.Replace("'", "''") ?? "";

            // 2. Format the file location as a proper URI
            string fileUri = new System.Uri(location ?? "").AbsoluteUri.Replace("'", "''");

            // 3. Build the entire layout natively using the working DOM method
            string psScript = $@"
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                
                # Fetch the native template
                $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText03)
                
                # Add our 3 lines of text
                $text = $xml.GetElementsByTagName('text')
                $text.Item(0).AppendChild($xml.CreateTextNode('{title}')) | Out-Null
                $text.Item(1).AppendChild($xml.CreateTextNode('{message}')) | Out-Null
                $text.Item(2).AppendChild($xml.CreateTextNode('{displayLocation}')) | Out-Null

                # Manually build and inject the button
                $actions = $xml.CreateElement('actions')
                $action = $xml.CreateElement('action')
                $action.SetAttribute('content', 'Open Location')
                $action.SetAttribute('arguments', '{fileUri}')
                $action.SetAttribute('activationType', 'protocol')
                $actions.AppendChild($action) | Out-Null
                $xml.DocumentElement.AppendChild($actions) | Out-Null

                # Show the Toast
                $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('LogiPlugin').Show($toast)
            ";

            string base64 = System.Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(psScript));

            var startInfo = new ProcessStartInfo("powershell", $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand {base64}")
            {
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            };
            Process.Start(startInfo);
        }

        private static void RunPowerShell(string psCommand)
        {
            var startInfo = new ProcessStartInfo("powershell", $"-NoProfile -ExecutionPolicy Bypass -Command \"{psCommand}\"")
            {
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            };
            Process.Start(startInfo);
        }
    }
}