import { BladesHelpers } from "./blades-helpers.js";


export const registerSystemKeybinds = function() {
  game.keybindings.register("beamsaber", "IncrementClock", {
    name: game.i18n.localize('BITD.Keybinds.IncrementClock.Name'),
    hint: game.i18n.localize('BITD.Keybinds.IncrementClock.Hint'),
    editable: [
      {
        key: "KeyM",
        modifiers: ["Control"]
      }
    ],
    onDown: async (context) => {
      let maxClocks = context.event.shiftKey;
      const clockActors = canvas.tokens.controlled.map(t => t.actor).filter(a => a.type == '\uD83D\uDD5B clock').filter(c => c.system.value !== c.system.size);
      for (let clockActor of clockActors) {
        let updateObject = {'system.value': maxClocks ? Number(clockActor.system.size) : (Number(clockActor.system.value) + 1)};
        updateObject = await clockActor.sheet.updateTokens(updateObject);
        await BladesHelpers.tryUpdate(clockActor, updateObject);
      }
    },
    restricted: true,
    reservedModifiers: ["Shift"],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register("beamsaber", "DecrementClock", {
    name: game.i18n.localize('BITD.Keybinds.DecrementClock.Name'),
    hint: game.i18n.localize('BITD.Keybinds.DecrementClock.Hint'),
    editable: [
      {
        key: "KeyL",
        modifiers: ["Control"]
      }
    ],
    onDown: async (context) => {
      let emptyClocks = context.event.shiftKey;
      const clockActors = canvas.tokens.controlled.map(t => t.actor).filter(a => a.type == '\uD83D\uDD5B clock').filter(c => c.system.value !== 0);
      for (let clockActor of clockActors) {
        let updateObject = {'system.value': emptyClocks ? 0 : (Number(clockActor.system.value) - 1)};
        updateObject = await clockActor.sheet.updateTokens(updateObject);
        await BladesHelpers.tryUpdate(clockActor, updateObject);
      }
    },
    restricted: true,
    reservedModifiers: ["Shift"],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
}