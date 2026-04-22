namespace Loupedeck.LolePlugin
{
    using System;

    public class ChromeTabSwitcherAdjustment : PluginDynamicAdjustment
    {
        // THE FIX: This acts as our buffer to store partial turns
        private int _tickAccumulator = 0;

        // SENSITIVITY CONTROL: How many physical dial clicks equal 1 tab switch. 
        // Increase this number to make the dial require a larger physical turn!
        private const int TICKS_PER_TAB_SWITCH = 10;

        public ChromeTabSwitcherAdjustment()
            : base(displayName: "Switch Chrome Tabs", description: "Use the dialpad to rotate through tabs (works bothways)", groupName: "Adjustments (1)", hasReset: false)
        {
        }

        protected override void ApplyAdjustment(String actionParameter, Int32 diff)
        {
            // 1. Add the incoming physical ticks to our buffer
            _tickAccumulator += diff;

            // 2. Check if we turned right enough times to trigger a "Next Tab"
            while (_tickAccumulator >= TICKS_PER_TAB_SWITCH)
            {
                ChromeWindowManagerAPI.SwitchTab(false); // False = Forward

                // Subtract the used ticks from the buffer, keeping any leftover momentum
                _tickAccumulator -= TICKS_PER_TAB_SWITCH;
            }

            // 3. Check if we turned left enough times to trigger a "Previous Tab"
            while (_tickAccumulator <= -TICKS_PER_TAB_SWITCH)
            {
                ChromeWindowManagerAPI.SwitchTab(true); // True = Reverse

                // Add back the used ticks to step the negative buffer back toward zero
                _tickAccumulator += TICKS_PER_TAB_SWITCH;
            }
        }

        protected override void RunCommand(String actionParameter)
        {
            // Optional: Reset the accumulator if the dial is pressed
            _tickAccumulator = 0;
        }

        protected override String GetAdjustmentValue(String actionParameter) => "";
    }
}