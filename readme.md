## Project Name: LoLé (Logiciel offering 4 logitech écosystème)
<p align="justify">
LoLé is a powerful productivity bridge that seamlessly connects your physical Logitech hardware (Creative Console) directly to your digital browser workflows. By functioning as a universal, profile-aware Chrome extension, 
it eliminates context switching and allows you to execute complex OS-level tasks and browser automations with a single physical input.
</p>

<br>

## Installation Guide
<p align="justify">
I have uploaded the required files on my server. Just click on the following links to dowload the files & use the project on your local machine: 
<a href="https://hackathonmaverick.in/Lole.lplug4">Plugin installation file (.lplug4)</a>   &     <a href="https://hackathonmaverick.in/lole-extension.zip">Extension zipped file</a>

The lplug4 file is ready to be used, as it will install the plugin on your options+ app, but as of now the Chrome extension is <b>not published</b> on the Chrome Web Store, as it takes around
1-week for approval. I have sent the extension for approval to the Google team, and the extension will be available to the users by the next week. Till then, you have to follow the below steps
to successfully load the extension in your Chrome browser:

<ol>
  <li>Extract the extension's zipped file</li>
  <li>Open chrome://extensions page & enable the developer mode (toggle switch)</li>
  <li>Click on load unpacked (top-left button) & select the extension folder (make sure to select the directory of extension which has <b>src folder</b></li>
</ol>

<img src="readme_img/extension.png" align="centre">

> These are the simple 3-steps which allow you to have the extension on your chrome browser, and use the project to the fullest. Note that, these steps are there as the extension is not yet published. 
Once its published on the webstore, then user will get this installed in a click.
</p>

## 
<p align="center">
Both, the plugin & extension, will show warning to the users that you are missing another part of the project, in case, both of the components are not installed.
</p>

<br>

<img src="readme_img/plugin_error.jpg">
<img src="readme_img/extension_error.jpg">

<br>

## C# Breakdown
<p align="justify">
1. <a href="Lole%20plugin/src/Actions/CounterCommand.cs">CounterCommand.cs</a>: It features the LoLeBaseCommand abstract class, which implements a "Focus-First" logic. Before any web action runs, it checks if Chrome is active; if not, it automatically launches the correct Chrome profile before sending the command. Contains <b>24 custom actions</b> like DeepCleanCommand, RenameLogiCommand, and ToggleDesktopCommand <br><br>
2. <a href="Lole%20plugin/src/Actions/CounterAdjustment.cs">CounterAdjustment.cs</a>: Tailored for efficient context switching. We implemented logic to handle "Tab Swiping" and volume adjustments using asynchronous calls to ensure the hardware dial remains responsive without UI lag. Contains only a single action titled "Switch Chrome Tabs" <br><br>
3. <a href="Lole%20plugin/src/DesktopIconManagerAPI.cs">DesktopIconManagerAPI.cs</a>: It targets the `SHELLDLL_DefView` and `WorkerW layers` to find the hidden desktop list handle. This allows the "Icon Island" feature—automatically arranging or restoring your desktop icon layout with a single hardware tap. <br><br>
4. <a href="Lole%20plugin/src/LolePlugin.cs">LolePlugin.cs</a>: We built a dynamic asset delivery system here. Upon loading, it checks for the existence of .lp5 keypad/dialpad profiles and downloads them from our server only if missing. It also manages the persistent "TargetChromeProfile" setting <br><br>
5. <a href="Lole%20plugin/src/NotificationHelper.cs">NotificationHelper.cs</a>: We developed a specialized PowerShell-based XML injector. It can generate standard 2-line alerts or modern, interactive notifications featuring an "Open Location" button that uses protocol activation (file:///) to launch Windows Explorer directly to a specific folder. <br><br>
6. <a href="Lole%20plugin/src/WebService.cs">WebService.cs</a>: This is the most critical file. It facilitates bidirectional, real-time communication between the hardware plugin and your Chrome extension. It includes specialized sub-APIs:
  <ul>
    <li>SystemCleanerAPI: Executes deep-clean logic to free up disk space</li>
    <li>ChromeAccountAPI: Reads Chrome Preferences files to identify synced Google profiles</li>
    <li>ChromeWindowManagerAPI: Uses WMI filters to find and focus specific Chrome profile instances natively</li>
  </ul>
</p>
