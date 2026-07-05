import { ClockStylesData } from "./models/clock-styles.js";
import { ClockStylesSettings } from "./settings/clock-styles.js"

export const registerSystemSettings = function() {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("beamsaber", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.registerMenu('beamsaber', 'ClockStylesMenu', {
    name: game.i18n.localize('BITD.Settings.ClockStyles.Name'),
    label: game.i18n.localize('BITD.Settings.ClockStyles.Label'),
    hint: game.i18n.localize('BITD.Settings.ClockStyles.Hint'),
    icon: "fa-solid fa-chart-pie",
    type: ClockStylesSettings,
    restricted: true
  });

  game.settings.register('beamsaber', 'DefaultClockThemeColor', {
    name: game.i18n.localize('BITD.Settings.DefaultClockThemeColor.Name'),
    hint: game.i18n.localize('BITD.Settings.DefaultClockThemeColor.Hint'),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: String,
    choices: () => {
      let themes = {};
      for (let [themeName, theme] of Object.entries(BladesHelpers.clockStyles))
        if (themeName != 'dataReason')
          for (let [colorName, color] of Object.entries(theme))
            if (colorName != 'dataReason')
              themes[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;
      return themes;
    },
    default: 'beamsaber/cyan'
  });

  game.settings.register('beamsaber', 'ActorDragAndDrop', {
    name: game.i18n.localize('BITD.Settings.ActorDragAndDrop.Name'),
    hint: game.i18n.localize('BITD.Settings.ActorDragAndDrop.Hint'),
    config: true,
    scope: 'world',
    type: String,
    default: 'all',
    choices: {
      all: game.i18n.localize('BITD.Settings.ActorDragAndDrop.Everyone'),
      trusted: game.i18n.localize('BITD.Settings.ActorDragAndDrop.TrustedAndGMs'),
      gms: game.i18n.localize('BITD.Settings.ActorDragAndDrop.GMs'),
      gm_only: game.i18n.localize('BITD.Settings.ActorDragAndDrop.GMOnly')
    },
    requiresReload: true
  });

  game.settings.register('beamsaber', 'DeepCutLoad', {
    name: game.i18n.localize('BITD.Settings.Load.Name'),
    hint: game.i18n.localize('BITD.Settings.Load.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('beamsaber', 'Edge', {
    name: game.i18n.localize('BITD.Settings.Edge.Name'),
    hint: game.i18n.localize('BITD.Settings.Edge.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('beamsaber', 'PublicClocks', {
    name: game.i18n.localize('BITD.Settings.PublicClocks.Name'),
    hint: game.i18n.localize('BITD.Settings.PublicClocks.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('beamsaber', 'ClockStyles', {
    name: game.i18n.localize('BITD.Settings.ClockStyles.Name'),
    hint: game.i18n.localize('BITD.Settings.ClockStyles.Hint'),
    config: false,
    default: new ClockStylesData({
      contents: {
        flower: {
          pink: {
            2: {shifted: true},
            3: {shifted: true},
            4: {shifted: true},
            5: {shifted: true},
            6: {shifted: true},
            8: {shifted: true},
            10: {shifted: true},
            12: {shifted: true}
          }
        }
      }
    }),
    scope: 'world',
    type: ClockStylesData,
    requiresReload: true
  });

  game.settings.register('beamsaber', 'DowntimeRules', {
    name: game.i18n.localize('BITD.Settings.DowntimeRules.Name'),
    hint: game.i18n.localize('BITD.Settings.DowntimeRules.Hint'),
    scope: 'world',
    config: true,
    type: String,
    requiresReload: true,
    default: 'lax',
    choices: {
      strict: game.i18n.localize('BITD.Settings.DowntimeRules.Strict'),
      lax: game.i18n.localize('BITD.Settings.DowntimeRules.Lax')
    },
  });
};
