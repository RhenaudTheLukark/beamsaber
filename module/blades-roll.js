import { BladesHelpers } from "./blades-helpers.js";
import { BeamChatMessage } from "./messages/beam-chat-message.js";

/**
 * Object holding all existing roll modifiers.
 */
export const bladesRollModifierList = {
  collateral_die: {
    name: 'BITD.CollateralDie',
    notRollTypes: ['enhance', 'train', 'moveBase'],
    dice: 1,
    rollText: 'BITD.CollateralDieEffect'
  },
  push_yourself: {
    name: 'BITD.PushYourself',
    rollTypes: ['actionRoll', 'groupAction', 'fortune'],
    fields: {
      'BITD.Cost': [],
      'BITD.Effect': ['BITD.ExtraDie', 'BITD.ImprovedEffect', 'BITD.IgnoreHarmDamage']
    },
    resolveFunc: (fields, extraData) => {
      let isStress = fields['BITD.Cost'] ? fields['BITD.Cost'] == 'BITD.Stress' : !extraData.isVehicle;
      return {
        stress: isStress ? 2 : 0,
        dice: fields['BITD.Effect'] == 'BITD.ExtraDie' ? 1 : 0,
        effect: fields['BITD.Effect'] == 'BITD.ImprovedEffect' ? 1 : 0,
        rollText: `BITD.PushYourself${isStress ? 'Stress' : 'Quirk'}Effect`,
        pushYourself: true
      };
    },
    push_yourself: true
  },
  assist: {
    name: 'BITD.Assist',
    rollTypes: ['actionRoll', 'resistance', 'fortune', 'gatherInfo', 'engagement'],
    fields: {
      'BITD.Connection': [],
      'BITD.TacticalGenius': false,
      'BITD.Effects': ['BITD.ExtraDie', 'BITD.ImprovedPosition', 'BITD.ImprovedEffect', 'BITD.IgnoreHarmDamage'],
    },
    resolveFunc: (fields, extraData) => {
      let effectText = '';
      let dice = 0, effect = 0, position = 0;
      let connectionFull = BladesHelpers.resolveActor(fields['BITD.Connection']);
      let connectionValue = connectionFull ? BladesHelpers.fetchConnectionsToActor(extraData.actorFull.uuid).find(c => c.uuid == connectionFull.uuid).clock.value : 0;
      for (let choiceId in fields['BITD.Effects']) {
        let choice = fields['BITD.Effects'][choiceId];
        if (choiceId >= connectionValue) break;
        if (choice == 'BITD.ExtraDie') dice = 1;
        if (choice == 'BITD.ImprovedPosition') position = 1;
        if (choice == 'BITD.ImprovedEffect') effect = 1;
        effectText += `<li>${game.i18n.localize(choice + 'Effect')}</li>`;
      }
      let otherStress = {};
      let otherValue = {};
      if (!fields['BITD.TacticalGenius'])
        otherStress[connectionFull.uuid] = Math.min(connectionValue, fields['BITD.Effects'].length);
      else
        otherValue[connectionFull.uuid] = {'system.tactical_genius_uses.value': -1};
      return {
        dice: dice,
        effect: effect,
        position: position,
        otherStress: otherStress,
        otherValue: otherValue,
        rollText: `BITD.Assist${fields['BITD.TacticalGenius'] ? 'TacticalGenius' : ''}Effect`,
        rollTextArgs: { pilot: connectionFull ? connectionFull.name : 'Unknown Pilot', num: Math.min(connectionValue, fields['BITD.Effects'].length), effects: effectText } };
    },
    assist: true
  },
  setup: {
    name: 'BITD.Setup',
    rollTypes: ['actionRoll', 'groupAction'],
    fields: {
      'BITD.Effect': ['BITD.Position', 'BITD.Effect']
    },
    resolveFunc: (fields) => {
      let isEffect = fields['BITD.Effect'] == 'BITD.Effect';
      return { effect: isEffect ? 1 : 0, position: isEffect ? 0 : 1, rollText: 'BITD.SetupEffect', rollTextArgs: { effect: game.i18n.localize(fields['BITD.Effect']) } };
    }
  },
  advanced_prototype: {
    name: 'BITD.AbilityUpgrade.AdvancedPrototypeTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1,
    effect: 1
  },
  forgettable: {
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'sway',
    rollStatus: [ 'success', 'critical-success' ],
    rollText: 'BITD.AbilityUpgrade.Forgettable'
  },
  work_hard_play_hard: {
    rollType: 'cutLoose',
    rollText: 'BITD.AbilityUpgrade.WorkHardPlayHard',
    workHardPlayHard: true
  },
  broadcast: {
    hidden: true,
    needPushYourself: true,
    rollText: 'BITD.AbilityUpgrade.Broadcast'
  },
  emoji: {
    name: 'BITD.AbilityUpgrade.EmojiTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  farsight: {
    rollType: 'gatherInfo',
    attributeName: 'survey',
    dice: 1
  },
  telepathy: {
    name: 'BITD.AbilityUpgrade.TelepathyTitle',
    rollType: 'groupAction',
    fields: {
      'BITD.User': []
    },
    resolveFunc: (fields, extraData) => {
      return { dice: 0, telepathy: true, rollText: 'BITD.AbilityUpgrade.Telepathy', rollTextArgs: {owner: fields['BITD.User'], leader: extraData.leader} };
    },
    telepathy: true
  },
  ironwill: {
    rollType: 'resistance',
    attributeName: 'resolve',
    dice: 1
  },
  daredevil_desperate: {
    rollTypes: ['actionRoll', 'groupAction'],
    rollPosition: 'desperate',
    dice: 1
  },
  daredevil_resistance: {
    name: 'BITD.AbilityUpgrade.DaredevilTitle',
    rollType: 'resistance',
    dice: -1
  },
  warlord: {
    name: 'BITD.AbilityUpgrade.WarlordTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  weaving_the_web_gather_info: {
    name: 'BITD.AbilityUpgrade.WeavingTheWebGatherInfoTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  weaving_the_web_engagement: {
    name: 'BITD.AbilityUpgrade.WeavingTheWebEngagementTitle',
    rollType: 'engagement',
    dice: 1
  },
  the_devils_footsteps: {
    hidden: true,
    needPushYourself: true,
    rollText: 'BITD.AbilityUpgrade.TheDevilsFootsteps'
  },
  sharpshooter: {
    hidden: true,
    needPushYourself: true,
    rollText: 'BITD.AbilityUpgrade.Sharpshooter'
  },
  terminator: {
    name: 'BITD.AbilityUpgrade.TerminatorTitle',
    terminator: true,
    dice: 1
  },
  not_to_be_trifled_with: {
    hidden: true,
    needPushYourself: true,
    rollText: 'BITD.AbilityUpgrade.NotToBeTrifledWith'
  },
  vigorous: {
    rollType: 'recover',
    dice: 1
  },
  simulation: {
    rollType: 'engagement',
    dice: 1
  },
  meat_is_cheap_save_the_metal: {
    name: 'BITD.AbilityUpgrade.MeatIsCheapSaveTheMetalTitle',
    rollType: 'resistance',
    attributesName: ['insight', 'prowess', 'resolve'],
    dice: 1
  },
  red_comet: {
    name: 'BITD.AbilityUpgrade.RedCometTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  connected_downtime: {
    rollTypes: ['acquireAsset', 'schmooze'],
    result: 1
  },
  connected_ally: {
    name: 'BITD.AbilityUpgrade.ConnectedAllyTitle',
    rollTypes: ['actionRoll', 'groupAction', 'resistance'],
    dice: 1
  },
  cook_the_books: {
    name: 'BITD.AbilityUpgrade.CookTheBooksTitle',
    rollType: 'supply',
    stress: 2,
    downtime: -1
  },
  beneath_notice: {
    name: 'BITD.AbilityUpgrade.BeneathNoticeTitle',
    rollTypes: ['actionRoll', 'groupAction', 'resistance'],
    dice: 1
  },
  trust_in_me: {
    name: 'BITD.AbilityUpgrade.TrustInMeTitle',
    rollTypes: ['actionRoll', 'groupAction', 'resistance'],
    dice: 1
  },
  crowdsource: {
    name: 'BITD.AbilityUpgrade.CrowdsourceTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    fields: {
      'BITD.Crewmate': []
    },
    resolveFunc: (fields) => {
      let crewmateFull = BladesHelpers.resolveActor(fields['BITD.Crewmate']);
      return { dice: 0, stress: 2, crowdsource: true, target: fields['BITD.Crewmate'], rollText: 'BITD.AbilityUpgrade.Crowdsource', rollTextArgs: {teammate: crewmateFull.name} };
    },
    crowdsource: true
  },
  matrix_mind: {
    hidden: true,
    needPushYourself: true,
    name: 'BITD.AbilityUpgrade.MatrixMindTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  tesla: {
    hidden: true,
    needPushYourself: true,
    rollText: 'BITD.AbilityUpgrade.Tesla',
  },
  ambush: {
    name: 'BITD.AbilityUpgrade.AmbushTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  never_tell_me_the_odds: {
    name: 'BITD.AbilityUpgrade.NeverTellMeTheOddsTitle',
    rollType: 'resistance',
    dice: 1
  },
  lay_of_the_land: {
    name: 'BITD.AbilityUpgrade.LayOfTheLandTitle',
    rollType: 'resistance',
    dice: 1
  },
  ranger_gather_info: {
    name: 'BITD.AbilityUpgrade.RangerGatherInfoTitle',
    rollType: 'gatherInfo',
    result: 1
  },
  ranger_action: {
    name: 'BITD.AbilityUpgrade.RangerActionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  bodyguard_resistance: {
    name: 'BITD.AbilityUpgrade.BodyguardResistanceTitle',
    rollType: 'resistance',
    dice: 1
  },
  bodyguard_gather_info: {
    name: 'BITD.AbilityUpgrade.BodyguardGatherInfoTitle',
    rollType: 'gatherInfo',
    result: 1
  },
  brutal: {
    name: 'BITD.AbilityUpgrade.BrutalTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'command',
    dice: 1
  },
  robot_fighter: {
    name: 'BITD.AbilityUpgrade.RobotFighterTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  researcher: {
    rollType: 'manufacture',
    result: 1
  },
  saboteur: {
    name: 'BITD.AbilityUpgrade.SaboteurTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'wreck',
    rollText: 'BITD.AbilityUpgrade.Saboteur'
  },
  saboteur_explosives: {
    name: 'BITD.AbilityUpgrade.SaboteurExplosivesTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'wreck',
    dice: 1
  },
  quality_gear: {
    name: 'BITD.AbilityUpgrade.QualityGearTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  boosted_reactors: {
    name: 'BITD.VehicleGearUpgrade.BoostedReactorsTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    itemNeeded: 'is_boosted_reactors',
    effect: 1,
    rollText: 'BITD.VehicleGearUpgrade.BoostedReactors'
  },
  rage_position: {
    name: 'BITD.VehicleGearUpgrade.RAGEPositionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'maneuver',
    position: 1
  },
  rage_effect: {
    name: 'BITD.VehicleGearUpgrade.RAGEEffectTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'maneuver',
    effect: 1
  },
  special_ammunition_positive: {
    name: 'BITD.VehicleGearUpgrade.SpecialAmmunitionPositiveTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  special_ammunition_negative: {
    name: 'BITD.VehicleGearUpgrade.SpecialAmmunitionNegativeTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: -1
  },
  scary_weapon_tool: {
    name: 'BITD.VehicleGearUpgrade.ScaryWeaponToolTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  stimpack_position: {
    name: 'BITD.ItemUpgrade.StimpackPositionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    position: 1
  },
  stimpack_effect: {
    name: 'BITD.ItemUpgrade.StimpackEffectTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    effect: 1
  },
  intel: {
    name: 'BITD.ItemUpgrade.IntelTitle',
    rollType: 'gatherInfo',
    dice: 1,
    personnel: -1,
    rollText: 'BITD.ItemUpgrade.Intel'
  },
  predators: {
    name: 'BITD.SquadAbilityUpgrade.PredatorsTitle',
    rollTypes: ['actionRoll', 'groupAction', 'resistance'],
    dice: 1
  },
  vipers: {
    name: 'BITD.SquadAbilityUpgrade.VipersTitle',
    rollTypes: ['acquireAsset', 'manufacture'],
    dice: 1
  },
  friends_in_high_places: {
    rollType: 'supply',
    dice: 1
  },
  high_society: {
    name: 'BITD.SquadAbilityUpgrade.HighSocietyTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  noble_officer: {
    name: 'BITD.SquadAbilityUpgrade.NobleOfficerTitle',
    rollTypes: ['actionRoll', 'groupAction', 'resistance'],
    dice: 1
  },
  pr_campaign: {
    name: 'BITD.SquadAbilityUpgrade.PRCampaignTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  blood_brothers: {
    name: 'BITD.SquadAbilityUpgrade.BloodBrothersTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  forged_in_the_fire: {
    name: 'BITD.SquadAbilityUpgrade.ForgedInTheFireTitle',
    rollType: 'resistance',
    dice: 1
  },
  shock_and_awe: {
    name: 'BITD.SquadAbilityUpgrade.ShockAndAweTitle',
    rollType: 'engagement',
    dice: 1
  },
  just_passing_through: {
    name: 'BITD.SquadAbilityUpgrade.JustPassingThroughTitle',
    rollType: 'engagement',
    dice: 1
  },
  on_the_move_gather_info: {
    name: 'BITD.SquadAbilityUpgrade.OnTheMoveGatherInfoTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  on_the_move_upkeep: {
    name: 'BITD.SquadAbilityUpgrade.OnTheMoveUpkeepTitle',
    rollType: 'upkeep',
    materiel: 1,
    onTheMove: true,
    rollText: 'BITD.SquadAbilityUpgrade.OnTheMoveUpkeep',
  },
  scroungers_die: {
    rollType: 'salvage',
    dice: 1
  },
  scroungers_free: {
    name: 'BITD.SquadAbilityUpgrade.ScroungersFreeTitle',
    rollType: 'salvage',
    scroungers: true
  },
  air_superiority: {
    name: 'BITD.SquadAbilityUpgrade.AirSuperiorityTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributesName: ['battle', 'destroy', 'maneuver', 'bombard', 'manipulate', 'scan'],
    position: 1
  },
  custom_work: {
    name: 'BITD.SquadAbilityUpgrade.CustomWorkTitle',
    attributeName: 'engineer',
    dice: 1
  },
  formation: {
    name: 'BITD.SquadAbilityUpgrade.FormationTitle',
    rollType: 'groupAction',
    attributesName: ['battle', 'destroy', 'maneuver', 'bombard', 'manipulate', 'scan'],
    stress: 1,
    dice: 1,
    rollText: 'BITD.SquadAbilityUpgrade.Formation'
  },
  reavers: {
    name: 'BITD.SquadAbilityUpgrade.ReaversTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributesName: ['battle', 'destroy', 'maneuver', 'bombard', 'manipulate', 'scan'],
    needPushYourself: true,
    rollStatus: ['failure'],
    rollText: 'BITD.SquadAbilityUpgrade.Reavers',
  },
  of_the_people_position: {
    name: 'BITD.SquadAbilityUpgrade.OfThePeoplePositionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    position: 1
  },
  of_the_people_gather_info: {
    name: 'BITD.SquadAbilityUpgrade.OfThePeopleGatherInfoTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  the_good_stuff: {
    name: 'BITD.SquadAbilityUpgrade.TheGoodStuffTitle',
    rollType: 'manufacture',
    result: 99
  },
  pack_rats: {
    rollType: 'acquireAsset',
    dice: 1
  },
  second_story: {
    name: 'BITD.SquadAbilityUpgrade.SecondStoryTitle',
    rollType: 'engagement',
    dice: 1
  },
  slippery: {
    rollType: 'schmooze',
    dice: 1
  },
  conviction_cut_loose: {
    name: 'BITD.SquadAbilityUpgrade.ConvictionCutLooseTitle',
    rollType: 'cutLoose',
    convictionCutLoose: true
  },
  conviction_extra: {
    name: 'BITD.SquadAbilityUpgrade.ConvictionExtraTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    convictionExtra: true,
    dice: 1,
    rollText: 'BITD.SquadAbilityUpgrade.ConvictionExtra'
  },
  for_the_greater_good: {
    name: 'BITD.SquadAbilityUpgrade.ForTheGreaterGoodTitle',
    dice: 1,
  },
  grounded_resistance: {
    name: 'BITD.SquadAbilityUpgrade.GroundedResistanceTitle',
    rollType: 'resistance',
    dice: 1
  },
  grounded_recover: {
    name: 'BITD.SquadAbilityUpgrade.GroundedRecoverTitle',
    rollType: 'recover',
    dice: 1
  },
  irons_in_the_fire: {
    rollType: 'longTermProject',
    dice: 1
  },
  repair_bay_long_term_project: {
    name: 'BITD.SquadUpgrade.RepairBayLongTermProjectTitle',
    rollType: 'longTermProject',
    needsRealWorkshop: true,
    dice: 1
  },
  repair_bay_salvage_repair: {
    hidden: true,
    rollTypes: ['salvage', 'fix'],
    needsRealWorkshop: true,
    dice: 1
  },
  laboratory_long_term_project: {
    name: 'BITD.SquadUpgrade.LaboratoryLongTermProjectTitle',
    rollType: 'longTermProject',
    needsRealWorkshop: true,
    dice: 1
  },
  laboratory_recover: {
    hidden: true,
    rollType: 'recover',
    needsRealWorkshop: true,
    dice: 1
  },
  cctv_network: {
    name: 'BITD.SquadUpgrade.CCTVNetworkTitle',
    attributeName: 'survey',
    dice: 1
  },
  commissary: {
    name: 'BITD.SquadUpgrade.CommissaryTitle',
    attributeName: 'consort',
    dice: 1
  },
  forgers_workshop: {
    name: 'BITD.SquadUpgrade.ForgersWorkshopTitle',
    rollType: 'engagement',
    dice: 1
  },
  factory: {
    rollType: 'fix',
    dice: 1
  },
  guerilla_hideout: {
    name: 'BITD.SquadUpgrade.GuerillaHideoutTitle',
    rollType: 'engagement',
    dice: 1
  },
  hack_lab: {
    name: 'BITD.SquadUpgrade.HackLabTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'interface',
    dice: 1
  },
  holo_grid: {
    name: 'BITD.SquadUpgrade.HoloGridTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'consort',
    dice: 1
  },
  infirmary: {
    rollType: 'recover',
    dice: 1
  },
  loyal_bar: {
    name: 'BITD.SquadUpgrade.LoyalBarTitle',
    rollType: 'gatherInfo',
    dice: 1
  },
  luxury_venue: {
    name: 'BITD.SquadUpgrade.LuxuryVenueTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'sway',
    dice: 1
  },
  personal_clothier: {
    name: 'BITD.SquadUpgrade.PersonalClothierTile',
    rollType: 'engagement',
    dice: 1
  },
  private_office: {
    name: 'BITD.SquadUpgrade.PrivateOfficeTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'command',
    dice: 1
  },
  radar_station: {
    name: 'BITD.SquadUpgrade.RadarStationTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'scan',
    dice: 1
  },
  regional_records: {
    name: 'BITD.SquadUpgrade.RegionalRecordsTitle',
    rollType: 'engagement',
    dice: 1
  },
  scrapyard: {
    rollType: 'upkeep',
    dice: 1
  },
  secret_routes: {
    name: 'BITD.SquadUpgrade.SecretRoutesTitle',
    rollType: 'engagement',
    dice: 1
  },
  supercomputer: {
    name: 'BITD.SquadUpgrade.SupercomputerTitle',
    rollType: 'engagement',
    dice: 1
  },
  transmitter_array: {
    name: 'BITD.SquadUpgrade.TransmitterArrayTitle',
    notRollTypes: ['enhance', 'train', 'moveBase'],
    stress: -1
  },
  tunnels: {
    name: 'BITD.SquadUpgrade.TunnelsTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'prowl',
    dice: 1
  },
  warehouses: {
    rollType: 'acquireAsset',
    dice: 1
  },
  elite_adepts: {
    name: 'BITD.SquadUpgrade.EliteAdeptsTitle',
    cohortGangType: 'Adepts',
    dice: 1
  },
  elite_rooks: {
    name: 'BITD.SquadUpgrade.EliteRooksTitle',
    cohortGangType: 'Rooks',
    dice: 1
  },
  elite_rovers: {
    name: 'BITD.SquadUpgrade.EliteRoversTitle',
    cohortGangType: 'Rovers',
    dice: 1
  },
  elite_skulks: {
    name: 'BITD.SquadUpgrade.EliteSkulksTitle',
    cohortGangType: 'Skulks',
    dice: 1
  },
  elite_toughs: {
    name: 'BITD.SquadUpgrade.EliteToughsTitle',
    cohortGangType: 'Toughs',
    dice: 1
  },
  supply_failure: {
    name: 'BITD.OtherModifier.SupplyFailureTitle',
    rollType: 'supply',
    dice: -2
  },
  downtime_assist: {
    name: 'BITD.Assist',
    rollTypes: ['acquireAsset', 'collect', 'fix', 'longTermProject', 'manufacture', 'recover', 'salvage', 'schmooze', 'upkeep'],
    fields: {
      'BITD.Helper': []
    },
    resolveFunc: (fields, extraData) => {
      let otherHelper = fields['BITD.Helper'] == '';
      let dice = otherHelper ? 0 : 1;
      let helperFull = BladesHelpers.resolveActor(fields['BITD.Helper']);
      return {
        dice: dice,
        rollText: otherHelper ? 'BITD.DowntimeAssistOtherEffect' : 'BITD.DowntimeAssistEffect',
        rollTextArgs: { pilot: helperFull?.name } };
    },
    downtime_assist: true
  },
  acquire_asset_danger: {
    name: 'BITD.OtherModifier.AcquireAssetDangerTitle',
    resultStatus: [ 'success' ],
    rollType: 'acquireAsset',
    rollText: 'BITD.OtherModifier.AcquireAssetDanger',
    patronTrust: -2
  },
  acquire_asset_again: {
    name: 'BITD.OtherModifier.AcquireAssetAgainTitle',
    rollType: 'acquireAsset',
    dice: 1
  },
  acquire_asset_extra_die: {
    name: 'BITD.OtherModifier.AcquireAssetExtraDieTitle',
    rollType: 'acquireAsset',
    dice: 1,
    materiel: -1,
    rollText: 'BITD.OtherModifier.AcquireAssetExtraDie',
  },
  acquire_asset_cohort: {
    name: 'BITD.OtherModifier.AcquireAssetCohortTitle',
    nameArgs: {num: `{system.region.system.might}`},
    rollType: 'acquireAsset',
    needsRegion: true,
    checkFunc: (extraData) => {
      let regionFull = BladesHelpers.resolveActor(extraData.actorFull.system.region);
      let ownerFull = BladesHelpers.resolveActor(regionFull?.system.owner);
      if (ownerFull && ownerFull.type != 'faction')
        ownerFull = BladesHelpers.resolveActor(ownerFull.system.faction);
      return ownerFull != null;
    },
    resolveFunc: (fields, extraData) => {
      let regionFull = BladesHelpers.resolveActor(extraData.actorFull.system.region);
      let ownerFull = BladesHelpers.resolveActor(regionFull?.system.owner);
      if (ownerFull && ownerFull.type != 'faction')
        ownerFull = BladesHelpers.resolveActor(ownerFull.system.faction);
      if (!ownerFull)
        return false;
      let otherTrust = {};
      otherTrust[ownerFull.uuid] = -Number(regionFull.system.might);
      return { dice: Number(regionFull.system.might), otherTrust: otherTrust, rollText: 'BITD.OtherModifier.AcquireAssetCohort', rollTextArgs: {faction: ownerFull.name, num: regionFull.system.might} };
    },
  },
  acquire_asset_gear: {
    name: 'BITD.OtherModifier.AcquireAssetGearTitle',
    nameArgs: {num: '{system.region.system.tech}'},
    rollType: 'acquireAsset',
    needsRegion: true,
    checkFunc: (extraData) => {
      let regionFull = BladesHelpers.resolveActor(extraData.actorFull.system.region);
      let ownerFull = BladesHelpers.resolveActor(regionFull?.system.owner);
      if (ownerFull && ownerFull.type != 'faction')
        ownerFull = BladesHelpers.resolveActor(ownerFull.system.faction);
      return ownerFull != null;
    },
    resolveFunc: (fields, extraData) => {
      let regionFull = BladesHelpers.resolveActor(extraData.actorFull.system.region);
      let ownerFull = BladesHelpers.resolveActor(regionFull?.system.owner);
      if (ownerFull && ownerFull.type != 'faction')
        ownerFull = BladesHelpers.resolveActor(ownerFull.system.faction);
      if (!ownerFull)
        return false;
      let otherTrust = {};
      otherTrust[ownerFull.uuid] = -Number(regionFull.system.tech);
      return { dice: Number(regionFull.system.tech), otherTrust: otherTrust, rollText: 'BITD.OtherModifier.AcquireAssetGear', rollTextArgs: {faction: ownerFull.name, num: regionFull.system.tech} };
    },
  },
  collect_bonus_roll: {
    name: 'BITD.OtherModifier.CollectBonusRollTitle',
    rollType: 'collect',
    personnel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.CollectBonusRoll'
  },
  cut_loose_bonus_roll: {
    name: 'BITD.OtherModifier.CutLooseBonusRollTitle',
    rollType: 'cutLoose',
    personnel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.CutLooseBonusRoll'
  },
  cut_loose_extra_die: {
    name: 'BITD.OtherModifier.CutLooseExtraDieTitle',
    rollType: 'cutLoose',
    dice: 1,
    personnel: -1,
    rollText: 'BITD.OtherModifier.CutLooseExtraDie',
  },
  enhance_bonus_roll: {
    name: 'BITD.OtherModifier.EnhanceBonusRollTitle',
    rollType: 'enhance',
    materiel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.EnhanceBonusRoll'
  },
  fix_bonus_roll: {
    name: 'BITD.OtherModifier.FixBonusRollTitle',
    rollType: 'fix',
    materiel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.FixBonusRoll'
  },
  fix_extra_die: {
    name: 'BITD.OtherModifier.FixExtraDieTitle',
    rollType: 'fix',
    dice: 1,
    materiel: -1,
    rollText: 'BITD.OtherModifier.FixExtraDie',
  },
  long_term_project_bonus_roll: {
    name: 'BITD.OtherModifier.LongTermProjectBonusRollTitle',
    rollType: 'longTermProject',
    personnel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.LongTermProjectBonusRoll'
  },
  long_term_project_extra_die: {
    name: 'BITD.OtherModifier.LongTermProjectExtraDieTitle',
    rollType: 'longTermProject',
    dice: 1,
    personnel: -1,
    rollText: 'BITD.OtherModifier.LongTermProjectExtraDie',
  },
  recover_bonus_roll: {
    name: 'BITD.OtherModifier.RecoverBonusRollTitle',
    rollType: 'recover',
    personnel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.RecoverBonusRoll'
  },
  recover_extra_die: {
    name: 'BITD.OtherModifier.RecoverExtraDieTitle',
    rollType: 'recover',
    dice: 1,
    personnel: -1,
    rollText: 'BITD.OtherModifier.RecoverExtraDie',
  },
  salvage_bonus_roll: {
    name: 'BITD.OtherModifier.SalvageBonusRollTitle',
    rollType: 'salvage',
    materiel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.SalvageBonusRoll'
  },
  schmooze_bonus_roll: {
    name: 'BITD.OtherModifier.SchmoozeBonusRollTitle',
    rollType: 'schmooze',
    personnel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.SchmoozeBonusRoll'
  },
  schmooze_extra_die: {
    name: 'BITD.OtherModifier.SchmoozeExtraDieTitle',
    rollType: 'schmooze',
    dice: 1,
    personnel: -1,
    rollText: 'BITD.OtherModifier.SchmoozeExtraDie',
  },
  train_bonus_roll: {
    name: 'BITD.OtherModifier.TrainBonusRollTitle',
    rollType: 'train',
    materiel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.TrainBonusRoll'
  },
  upkeep_downtime_free: {
    name: 'BITD.OtherModifier.UpkeepDowntimeFreeTitle',
    rollType: 'upkeep',
    bonusRoll: true
  },
  upkeep_bonus_roll: {
    name: 'BITD.OtherModifier.UpkeepBonusRollTitle',
    rollType: 'upkeep',
    materiel: -1,
    bonusRoll: true,
    rollText: 'BITD.OtherModifier.UpkeepBonusRoll'
  },
}

export const positionIndex = ['desperate', 'risky', 'controlled'];
export const effectIndex = ['limited', 'standard', 'great'];

/**
 * Roll Dice.
 * @param {int} diceAmount
 * @param {string} attributeOrRollName
 * @param {string} position
 * @param {string} effect
 */
export async function bladesRoll(diceAmount, attributeOrRollName = '', note = '', extraFields = {}) {
  if (attributeOrRollName == 'BITD.CohortRoll' && !extraFields.within_expertise) diceAmount = 0;

  let numberedPosition = positionIndex.indexOf(extraFields.position);
  let numberedEffect = effectIndex.indexOf(extraFields.effect);

  let rollData = extraFields.rollData ?? {modifiers: foundry.utils.deepClone(extraFields.modifiers), note: note};

  let stressChanges = {};
  stressChanges[extraFields.actor?.uuid] = 0;

  let squadFull = BladesHelpers.resolveActor(extraFields.actor?.system.crew);
  let factionFull = BladesHelpers.resolveActor(squadFull?.system.faction);
  let trustChanges = {};
  if (factionFull)
    trustChanges[factionFull?.uuid] = 0;
  let materielChanges = extraFields.materiel ?? 0;
  let personnelChanges = extraFields.personnel ?? 0;
  let rollTypeKey = Object.entries(rollTypeLabels).find(r => r[1] == attributeOrRollName);
  let otherChanges = {};
  let downtimeCountChanges = rollTypeKey ? (BladesHelpers.isDowntime(rollTypeKey[0]) ? -1 : 0) : 0;

  // Add modifiers effects to the roll/actor
  for (let modifier of extraFields.modifiers) {
    if (modifier.dice) diceAmount += modifier.dice;
    if (modifier.position && extraFields.position) numberedPosition += modifier.position;
    if (modifier.effect && extraFields.effect) numberedEffect += modifier.effect;
    if (modifier.stress) stressChanges[extraFields.actor?.uuid] = Number(modifier.stress);
    if (modifier.otherStress)
      for (let [uuid, value] of Object.entries(modifier.otherStress))
        stressChanges[uuid] = (stressChanges[uuid] ?? 0) + Number(value);
    if (modifier.patronTrust) trustChanges[factionFull?.uuid] += modifier.patronTrust;
    if (modifier.otherTrust)
      for (let [uuid, value] of Object.entries(modifier.otherTrust))
        trustChanges[uuid] = (trustChanges[uuid] ?? 0) + Number(value);
    if (modifier.materiel) materielChanges += modifier.materiel;
    if (modifier.personnel) personnelChanges += modifier.personnel;
    if (modifier.bonusRoll) {
      downtimeCountChanges = 0;
      extraFields.bonusRoll = true;
    }
    if (modifier.otherValue)
      for (let [uuid, value] of Object.entries(modifier.otherValue))
        otherChanges[uuid] = otherChanges[uuid] ? {...otherChanges[uuid], ...value} : value;
    if (modifier.downtime) downtimeCountChanges += modifier.downtime;
    if (modifier.convictionCutLoose) extraFields.conviction = true;
    if (modifier.workHardPlayHard) extraFields.workHardPlayHard = true;
    if (modifier.onTheMove) {
      let diff = 1 - extraFields.upkeepDice;
      materielChanges -= diff;
      diceAmount += diff;
    }
  }

  // Irons in the Fire: Cancel extra die if only one project is selected
  if (extraFields.ltpIds?.length == 1) {
    diceAmount --;
    extraFields.ltpId = extraFields.ltpIds[0];
    extraFields.ltpIds = undefined;
  }

  extraFields.materiel = materielChanges;
  if (extraFields.materiel != 0)
    rollData.materiel = materielChanges;
  extraFields.personnel = personnelChanges;
  if (extraFields.personnel != 0)
    rollData.personnel = personnelChanges;

  // Stress Changes
  if (rollData.stressChanges)
    rollData.oldStressChanges = rollData.stressChanges;
  rollData.stressChanges = {};
  for (let [stressActorUuid, stressChange] of Object.entries(stressChanges)) {
    let stressChangeItem = {value: stressChange, realValue: stressChange};
    let stressActorFull = BladesHelpers.resolveActor(stressActorUuid);
    if (stressChange != 0 && stressActorFull?.system.stress?.value != undefined) {
      let resultStress = Math.max(Math.min(Number(stressActorFull.system.stress.value) + stressChange, stressActorFull.system.stress.max), 0);
      stressChangeItem.realValue = resultStress - Number(stressActorFull.system.stress.value);
      if (resultStress != stressActorFull.system.stress.value)
        await BladesHelpers.tryUpdate(stressActorFull, {system: {stress: {'==value': resultStress}}});
      rollData.stressChanges[stressActorFull._id] = stressChangeItem;
    }
  }

  // Trust Changes
  if (rollData.trustChanges)
    rollData.oldTrustChanges = rollData.trustChanges;
  rollData.trustChanges = {};
  for (let [trustActorUuid, trustChange] of Object.entries(trustChanges)) {
    if (trustChange == 0) continue;
    let trustActorFull = BladesHelpers.resolveActor(trustActorUuid);
    if (!trustActorFull) continue;
    let [trustText, trustValue] = await BladesHelpers.handleTrust(trustActorFull, squadFull, trustChange);
    if (trustText)
      extraFields.modifier_text = `<p>${trustText}</p>`;
    rollData.trustChanges[trustActorFull._id] = {value: trustChange, realValue: trustValue};
  }

  // Materiel & Personnel Changes
  let squadUpdateObject = {system: {}};
  if (materielChanges) {
    squadUpdateObject.system.materiel = {'==value': Math.min(Math.max(Number(squadFull.system.materiel.value) + materielChanges, 0), Number(squadFull.system.materiel.max))};
    rollData.realMateriel = squadUpdateObject.system.materiel - Number(squadFull.system.materiel.value);
  }
  if (personnelChanges) {
    squadUpdateObject.system.personnel = {'==value': Math.min(Math.max(Number(squadFull.system.personnel.value) + personnelChanges, 0), Number(squadFull.system.personnel.max))};
    rollData.realPersonnel = squadUpdateObject.system.personnel - Number(squadFull.system.personnel.value);
  }
  if (Object.keys(squadUpdateObject.system).length)
    await BladesHelpers.tryUpdate(squadFull, squadUpdateObject);

  // Other Changes
  if (rollData.otherChanges)
    rollData.oldOtherChanges = rollData.otherChanges;
  rollData.otherChanges = {};
  for (let [otherActorUuid, otherChangeObj] of Object.entries(otherChanges)) {
    if (Object.values(otherChangeObj).length == 0) continue;
    let otherActorFull = BladesHelpers.resolveActor(otherActorUuid);
    if (otherActorFull) {
      let otherChangeItem = {value: {}, realValue: {}};
      let updateObject = {};
      for (let [otherPath, otherChange] of Object.entries(otherChangeObj)) {
        let otherValue = otherActorFull;
        for (let pathPart of otherPath.split('.')) {
          if (!otherValue)
            break;
          otherValue = otherValue[pathPart];
        }
        let resultOther = Math.max(Number(otherValue) + otherChange, 0);
        updateObject[otherPath] = resultOther;
        otherChangeItem.realValue[otherPath] = resultOther - Number(otherValue);
      }
      await BladesHelpers.tryUpdate(otherActorFull, updateObject);
      rollData.otherChanges[otherActorFull._id] = otherChangeItem;
    }
  }

  // Update the main actor in case of no further data update
  if (extraFields.actor) {
    let actorUpdateObject;
    if (extraFields.actor.type == 'character') {
      let downtimeShift = Math.max(extraFields.actor.system.downtime_count.value + downtimeCountChanges, 0);
      actorUpdateObject = {system: {
        downtime_count: {'==value': downtimeShift},
      }};
      if (downtimeCountChanges < 0) {
        let rollTypeString = Object.entries(rollTypeLabels).find(l => l[1] == attributeOrRollName)[0];
        actorUpdateObject.system.downtime_activities = {};
        actorUpdateObject.system.downtime_activities[`==${rollTypeString}`] = true;
        rollData.downtime = {value: downtimeShift, activities: {train_types: {}}};
        if (!extraFields.actor.system.downtime_activities[rollTypeString])
          rollData.downtime.activities[rollTypeString] = true;
        if (attributeOrRollName == 'BITD.TrainRoll') {
          actorUpdateObject.system.downtime_activities.train_types = {};
          actorUpdateObject.system.downtime_activities.train_types[`==${extraFields.trainType}`] = true;
          if (!extraFields.actor.system.downtime_activities.train_types[extraFields.trainType])
            rollData.downtime.activities.train_types[extraFields.trainType] = true;
        }
      }
    } else
      actorUpdateObject = {'==name': extraFields.actor.name};
    await BladesHelpers.tryUpdate(extraFields.actor, actorUpdateObject);
  }

  // Only apply modified position and effect if they haven't been forced
  if (extraFields.position && !extraFields.forcedPosition) extraFields.position = positionIndex[Math.min(Math.max(numberedPosition, 0), 2)];
  if (extraFields.effect && !extraFields.forcedEffect) extraFields.effect = effectIndex[Math.min(Math.max(numberedEffect, 0), 2)];

  extraFields.rollData = rollData;

  if (!extraFields.noRoll) {
    let zeromode = false;
    if (diceAmount < 0) diceAmount = 0;
    if (diceAmount === 0) {
      zeromode = true;
      diceAmount = 2;
    }

    let r;
    if (extraFields.rollData.rolls)
      r = extraFields.rollData.rolls;
    else {
      r = new Roll(`${diceAmount}d6`, {});
      // show 3d Dice so Nice if enabled
      await r.evaluate();
    }

    await showChatRollMessage(r, zeromode, attributeOrRollName, note, extraFields);
  } else
    await showChatMessage(diceAmount, attributeOrRollName, note, extraFields);
}

/**
 * Shows Chat message related to rolls.
 *
 * @param {Roll} r
 * @param {Boolean} zeromode
 * @param {String} attributeOrRollName
 * @param {string} position
 * @param {string} effect
 */
async function showChatRollMessage(r, zeromode, attributeOrRollName, note, extraFields) {
  let speaker = ChatMessage.getSpeaker();
  if (extraFields.actor)
    speaker = {
      actor: extraFields.actor._id,
      alias: extraFields.actor.name,
      scene: null,
      token: extraFields.actor.prototypeToken?._id
    };

  let attributeLabel = BladesHelpers.getRollLabel(attributeOrRollName);

  // Retrieve Roll status
  let rolls = (r.terms)[0].results;
  let [rollStatus, resultDie, extraResult] = getBladesRollStatus(rolls, zeromode, extraFields.modifiers);
  if (extraFields.forcedResult)
    rollStatus = extraFields.forcedResult;

  if (!extraFields.rollData)
    extraFields.rollData = {};
  extraFields.rollData.rolls = r;

  // Only keep valid modifiers with the given dice result
  extraFields.modifiers = keepValidModifiersFromStatus(extraFields.modifiers, rollStatus);

  let edge = rollStatus == 'critical-success';

  // Check and log if Dice Configuration is Manual
  let method = {};
  method.type = (r.terms)[0].method;
  if (method.type) {
    method.icon = CONFIG.Dice.fulfillment.methods[method.type].icon;
    method.label = CONFIG.Dice.fulfillment.methods[method.type].label;
  }

  // Compute extra text from modifiers
  extraFields.modifier_text = (extraFields.modifier_text ?? '') + computeModifierMessages(extraFields.modifiers);

  let result;
  // TODO: Extend rollData to all roll types
  // Check for Cohort roll
  if (attributeOrRollName == 'BITD.CohortRoll')
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/cohort-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, note: note, extraFields: extraFields });
  // Check for Group Action roll
  else if (extraFields.group_action) {
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/group-action-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, edge: edge, extraFields: extraFields });
    // Dire Action
    if (extraFields.dire && rollStatus == 'critical-success')
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': Math.max(Number(extraFields.actor.system.stress.value) - 1, 0)}}});
    if (extraFields.vehicle_dire && (rollStatus == 'failure' || (rollStatus == 'partial-success' && !extraFields.last_stand))) {
      let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
      await BladesHelpers.tryUpdate(vehicleFull, {system: {'==breakdown': Math.min(Number(vehicleFull.system.breakdown) + 1, Number(vehicleFull.system.breakdown_max))}});
    }
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    squadFull?.updateGroupActionRoll(extraFields.actor.id, rollStatus);
  }
  // Check for Action roll
  else if (BladesHelpers.isAttributeAction(attributeOrRollName)) {
    let positionLocalize = '';
    switch (extraFields.position) {
      case 'controlled':
        positionLocalize = 'BITD.PositionControlled'
        break;
      case 'desperate':
        positionLocalize = 'BITD.PositionDesperate'
        break;
      case 'risky':
      default:
        positionLocalize = 'BITD.PositionRisky'
    }

    let effectLocalize = '';
    switch (extraFields.effect) {
      case 'limited':
        effectLocalize = 'BITD.EffectLimited'
        break;
      case 'great':
        effectLocalize = 'BITD.EffectGreat'
        break;
      case 'standard':
      default:
        effectLocalize = 'BITD.EffectStandard'
    }
    // Dire Action
    if (extraFields.dire && rollStatus == 'critical-success')
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': Math.max(Number(extraFields.actor.system.stress.value) - 1, 0)}}});
    if (extraFields.vehicle_dire && (rollStatus == 'failure' || (rollStatus == 'partial-success' && !extraFields.last_stand))) {
      let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
      await BladesHelpers.tryUpdate(vehicleFull, {system: {'==breakdown': Math.min(Number(vehicleFull.system.breakdown) + 1, Number(vehicleFull.system.breakdown_max))}});
      await BladesHelpers.tryUpdate(extraFields.actor, {'==name': extraFields.actor.name});
    }

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/action-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, position_localize: positionLocalize, effect_localize: effectLocalize, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Resistance roll
  else if (attributeOrRollName == 'BITD.ResistanceRoll') {
    let stress = getBladesRollResistanceStress(rolls, extraResult, zeromode);
    let resultStress = Math.max(Math.min(Number(extraFields.actor.system.stress.value) + stress, Number(extraFields.actor.system.stress.max)), 0);
    if (resultStress != extraFields.actor.system.stress.value)
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': resultStress}}});
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/resistance-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, stress: stress, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Gather Information roll
  else if (attributeOrRollName == 'BITD.GatherInformationRoll')
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/gather-info-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, edge: edge, extraFields: extraFields });
  // Check for Engagement roll
  else if (attributeOrRollName == 'BITD.EngagementRoll')
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/engagement-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, edge: edge, extraFields: extraFields });
  // Check for Entanglement roll
  else if (attributeOrRollName == 'BITD.EntanglementRoll') {
    let squadFull = extraFields.actor.type == 'crew' ? extraFields.actor : BladesHelpers.resolveActor(extraFields.actor.system.crew);
    extraFields.slippery = squadFull.system.slippery;
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/entanglement-roll.html', { rolls: rolls, zeromode: zeromode, method: method, resultDie: resultDie, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Supply roll
  else if (attributeOrRollName == 'BITD.SupplyRoll') {
    let supplyPoints = getBladesRollCollect(rolls, extraResult, zeromode);
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/supply-roll.html', { rolls: rolls, zeromode: zeromode, method: method, num: supplyPoints, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Acquire Asset roll
  else if (attributeOrRollName == 'BITD.AcquireAssetRoll') {
    let successTier = Number(extraFields.successTier);
    let tierQuality = Number(extraFields.tier);
    let origTierQuality = tierQuality;
    switch (rollStatus) {
      case 'critical-success':
        tierQuality = tierQuality + 2;
        break;
      case 'success':
        tierQuality = tierQuality + 1;
        break;
      case 'failure':
        if (tierQuality > 0)
          tierQuality = tierQuality - 1;
        break;
      default:
        break;
    }
    let materielNeededForSuccess = 0;
    let qualityDiff = tierQuality - successTier;
    if (qualityDiff < 0) {
      let critSuccessTierDiff = successTier - (origTierQuality + 2);
      materielNeededForSuccess = -qualityDiff + Math.max(critSuccessTierDiff, 0);
    }
    let successRollStatus = materielNeededForSuccess > 0 ? 'failure' : 'success';
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/acquire-asset-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, success_roll_status: successRollStatus, attribute_label: attributeLabel, tier_quality: tierQuality, success_tier: successTier, success_materiel: materielNeededForSuccess, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Collect roll
  else if (attributeOrRollName == 'BITD.CollectRoll') {
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let supplyPoints = getBladesRollCollect(rolls, extraResult, zeromode);
    await BladesHelpers.tryUpdate(extraFields.region, {system: {'==collect_vigilance': extraFields.region.system.collect_vigilance + 1}});
    let entanglement = rolls.map(i => i.result).find(r => r == 1) >= 0;
    if (entanglement) {
      let ownerFull = BladesHelpers.resolveActor(extraFields.region.system.owner);
      // Try to get the owner's faction
      let originalOwnerFull = ownerFull;
      if (ownerFull && ownerFull.type != 'faction') {
        ownerFull = BladesHelpers.resolveActor(ownerFull.system.faction);
        if (!ownerFull)
          ownerFull = originalOwnerFull;
      }

      if (ownerFull) {
        let relationshipFull = await BladesHelpers.fetchRelationship(ownerFull, squadFull);
        entanglement = BladesHelpers.getEntanglementTable(Number(relationshipFull.status));
      } else
        entanglement = false;
    }

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/collect-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: supplyPoints == 9 ? 'critical-success' : 'success', region: extraFields.region.name, supply_points: supplyPoints, entanglement: entanglement, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Cut Loose roll
  else if (attributeOrRollName == 'BITD.CutLooseRoll') {
    extraFields.rollData.connectionUuid = extraFields.connection.uuid;
    let connectionFull = BladesHelpers.resolveActor(extraFields.connection);
    let clearStress = getBladesRollCutLooseUpkeep(rolls, extraResult, zeromode);
    if (extraFields.rollData.carouseStress)
      clearStress = Math.ceil(clearStress / 2);
    let realClearStress = clearStress;
    let remainingStress = extraFields.stress - clearStress;
    let savedByConviction = remainingStress < 0 && extraFields.conviction;
    let savedByFunctioningVice = (extraFields.actor.system.functioningVice && remainingStress >= -2 && remainingStress < 0) ? -remainingStress : 0;
    let savedByCarouse = extraFields.rollData.carouseStress == true && extraFields.rollData.oldStressChanges[extraFields.actor._id].value > extraFields.stress;
    if (!extraFields.forcedResult)
      rollStatus = (remainingStress >= 0 || savedByConviction || savedByCarouse || savedByFunctioningVice > 0) ? 'success' : 'failure';
    if (remainingStress < 0) {
      remainingStress = 0;
      clearStress = extraFields.stress;
    }
    // Functioning Vice: reduce other pilot's stress by 1
    if (extraFields.actor.system.functioningVice) {
      if (connectionFull.type == 'character') {
        if (Number(connectionFull.system.stress.value) > 0)
          if (extraFields.rollData.stressChanges[connectionFull._id]) {
            extraFields.rollData.stressChanges[connectionFull._id].value += 1;
            extraFields.rollData.stressChanges[connectionFull._id].realValue += 1;
          } else
            extraFields.rollData.stressChanges[connectionFull._id] = {value: 1, realValue: 1};
        await BladesHelpers.tryUpdate(connectionFull, {'system.stress.value': Math.max(Number(connectionFull.system.stress.value) - 1, 0)});
      }
    }
    extraFields.rollData.connections = {};
    // Increase the Pilot's connection clock by 1/2, reset the clock if maxxed
    let connectionId = Object.entries(extraFields.actor.system.connections).find(c => c[1].uuid == connectionFull.uuid)[0];
    let connection = extraFields.actor.system.connections[connectionId];
    let newClockValue = Number(connection.clock.value) + (extraFields.rollData.carousePilotRelationship ? 2 : 1);
    let clockMaxxed = newClockValue >= connection.clock.max;
    newClockValue = newClockValue - (clockMaxxed ? 3 : 0);
    let updateObject = {};
    updateObject[`system.connections.${connectionId}.clock.value`] = newClockValue;
    extraFields.rollData.connections[`${extraFields.actor._id}/${connectionFull._id}`] = newClockValue - Number(connection.clock.value);
    // Carouse: Increase relationship from the connection to the Pilot if the option is picked
    let otherClockMaxxed = false;
    if (extraFields.rollData.carouseOtherRelationship) {
      let connectionId = Object.entries(connectionFull.system.connections).find(c => c[1].uuid == extraFields.actor.uuid)[0];
      let connection = connectionFull.system.connections[connectionId];
      let newClockValue = Number(connection.clock.value) + 1;
      otherClockMaxxed = newClockValue >= connection.clock.max;
      newClockValue = newClockValue - (otherClockMaxxed ? 3 : 0);
      let connectionUpdateObject = {};
      connectionUpdateObject[`system.connections.${connectionId}.clock.value`] = newClockValue;
      extraFields.rollData.connections[`${connectionFull._id}/${extraFields.actor._id}`] = newClockValue - Number(connection.clock.value);
      await BladesHelpers.tryUpdate(connectionFull, connectionUpdateObject);
    }
    updateObject['system.stress.value'] = remainingStress;
    let shiftValue = remainingStress - extraFields.stress;
    if (extraFields.rollData.stressChanges[extraFields.actor._id]) {
      extraFields.rollData.stressChanges[extraFields.actor._id].value += realClearStress;
      extraFields.rollData.stressChanges[extraFields.actor._id].realValue += shiftValue;
    } else
      extraFields.rollData.stressChanges[extraFields.actor._id] = {value: realClearStress, realValue: shiftValue};
    await BladesHelpers.tryUpdate(extraFields.actor, updateObject);

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/cut-loose-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, saved_by_conviction: savedByConviction, saved_by_functioning_vice: savedByFunctioningVice, saved_by_carouse: savedByCarouse, attribute_label: attributeLabel, pilot: connectionFull ? connectionFull.name : 'Unknown Pilot', clear_stress: clearStress, connection_maxxed: clockMaxxed, other_connection_maxxed: otherClockMaxxed, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Fix roll
  else if (attributeOrRollName == 'BITD.FixRoll') {
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let workshop = squadFull?.system.workshop;
    let tick = getBladesRollDowntime(rolls, extraResult, zeromode);
    let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
    let levelOneDamage = vehicleFull.system.damage.light.one != '' || vehicleFull.system.damage.light.two != '';
    let clockFills = Math.floor((Number(vehicleFull.system.repair_clock.value) + tick) / Number(vehicleFull.system.repair_clock.max));
    let vehicleUpdateObject = {system: {repair_clock: {'==value': (Number(vehicleFull.system.repair_clock.value) + tick) % Number(vehicleFull.system.repair_clock.max)}}};

    // Update damage
    let damageLevels = ['', 'light', 'medium', 'heavy', 'deadly'];
    vehicleUpdateObject.system.damage = {light: {'==one': '', '==two': ''}};
    if (clockFills > 0)
      for (let [damageId, damageLevel] of Object.entries(damageLevels)) {
        if (damageId == 0) continue
        let sourceDamageId = Number(damageId) + clockFills;
        let sourceDamageLevel = sourceDamageId >= damageLevels.length ? '' : damageLevels[sourceDamageId];
        vehicleUpdateObject.system.damage[damageLevel] = {'==one': sourceDamageLevel != '' ? vehicleFull.system.damage[sourceDamageLevel].one : ''};
        if (damageId <= 2)
          vehicleUpdateObject.system.damage[damageLevel]['==two'] = (sourceDamageLevel != '' && sourceDamageId <= 2) ? vehicleFull.system.damage[sourceDamageLevel].two : '';
      }
    await BladesHelpers.tryUpdate(vehicleFull, vehicleUpdateObject);

    // Add stress if no workshop
    if (!workshop) {
      let resultStress = Math.max(Math.min(Number(extraFields.actor.system.stress.value) + 2, extraFields.actor.system.stress.max), 0);
      if (resultStress != extraFields.actor.system.stress.value)
        await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': resultStress}}});
    }
    await BladesHelpers.tryUpdate(extraFields.actor, {'==name': extraFields.actor.name});
    let fixActorName = extraFields.fixActor.uuid == extraFields.actor.uuid ? game.i18n.localize('BITD.You') : extraFields.fixActor.name;

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/fix-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, fixActorName: fixActorName, workshop: workshop, levelOneDamage: levelOneDamage, tick: tick, clockFills: clockFills, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Long-Term Project roll
  else if (attributeOrRollName == 'BITD.LongTermProjectRoll') {
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let crewUpdateObject = {system: {projects: {}}};
    let tick = getBladesRollDowntime(rolls, extraResult, zeromode);
    let baseTick = tick;
    let tickRemainder;
    // Irons in the Fire: Spread all ticks across all projects as evenly as possible
    if (extraFields.ltpIds) {
      let unfinishedProjectsData = Object.entries(squadFull.system.projects).filter(p => extraFields.ltpIds.includes(p[0])).map(p => { return {id: p[0], diff: Number(p[1].clock.max) - Number(p[1].clock.value)}; });
      let projectsString = unfinishedProjectsData.map(p => squadFull.system.projects[p.id].title).join(', ');
      if (game.i18n.lang == 'en') projectsString = projectsString.replace(/,([^,]*)$/, ' and$1');
      extraFields.projects = projectsString;
      let maxxedProjects = [];
      let eachTick;
      // Check which projects are done, remove them from the unfinishedProjectsData table if done, then recompute ticks
      while (true) {
        eachTick = Math.floor(tick / unfinishedProjectsData.length);
        tickRemainder = tick % unfinishedProjectsData.length;
        let newlyMaxxedProjects = [];
        for (let [projectDataId, projectData] of Object.entries(unfinishedProjectsData))
          if (eachTick >= projectData.diff) {
            newlyMaxxedProjects.push(projectDataId);
            maxxedProjects.push(projectData.id);
            tick -= projectData.diff;
          }
        if (newlyMaxxedProjects.length > 0) {
          for (let projectToRemove of newlyMaxxedProjects.reverse())
            unfinishedProjectsData.splice(projectToRemove, 1);
          if (unfinishedProjectsData.length == 0) {
            tickRemainder = 0;
            break;
          }
        } else
          break;
      }
      let overTicks = 0;
      if (unfinishedProjectsData.length == 0)
        overTicks = tick;
      tick = baseTick;
      for (let maxxedProject of maxxedProjects)
        crewUpdateObject.system.projects[maxxedProject] = {clock: {'==value': squadFull.system.projects[maxxedProject].clock.max}};
      for (let projectData of unfinishedProjectsData)
        crewUpdateObject.system.projects[projectData.id] = {clock: {'==value': Number(squadFull.system.projects[projectData.id].clock.value) + eachTick}};
      extraFields.allProjectsDone = unfinishedProjectsData.length == 0;
      let projectsDoneString = maxxedProjects.map(pId => squadFull.system.projects[pId].title).join(', ');
      if (game.i18n.lang == 'en') projectsDoneString = projectsDoneString.replace(/,([^,]*)$/, ' and$1');
      extraFields.projectsDone = projectsDoneString;
      extraFields.tickRemainder = tickRemainder;
      extraFields.overTicks = overTicks;
    } else {
      let project = squadFull.system.projects[extraFields.ltpId];
      let newTick = Math.min(Number(project.clock.value) + tick, Number(project.clock.max));
      let clockFilled = newTick >= Number(project.clock.max);
      if (clockFilled)
        tick = Number(project.clock.max) - Number(project.clock.value);
      crewUpdateObject.system.projects[extraFields.ltpId] = {clock: {'==value': newTick}};
      extraFields.project = project.title;
      extraFields.clockFilled = clockFilled;
    }
    await BladesHelpers.tryUpdate(squadFull, crewUpdateObject);
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/long-term-project-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, tick: tick, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Manufacture roll
  else if (attributeOrRollName == 'BITD.ManufactureRoll') {
    let successTier = Number(extraFields.successTier);
    let tierQuality = Number(extraFields.tier);
    let origTierQuality = tierQuality;
    switch (rollStatus) {
      case 'critical-success':
        tierQuality = tierQuality + 2;
        break;
      case 'success':
        tierQuality = tierQuality + 1;
        break;
      case 'failure':
        if (tierQuality > 0)
          tierQuality = tierQuality - 1;
        break;
      default:
        break;
    }
    let materielNeededForSuccess = Math.max(successTier - tierQuality, 0);
    let successRollStatus = materielNeededForSuccess > 0 ? 'failure' : 'success';
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/manufacture-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, success_roll_status: successRollStatus, attribute_label: attributeLabel, tier_quality: tierQuality, success_tier: successTier, success_materiel: materielNeededForSuccess, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Recover roll
  else if (attributeOrRollName == 'BITD.RecoverRoll') {
    let tick = getBladesRollDowntime(rolls, extraResult, zeromode);
    let levelOneHarm = extraFields.actor.system.harm.light.one != '' || extraFields.actor.system.harm.light.two != '';
    let min = Number(extraFields.actor.system.healing_clock.min);
    let value = Number(extraFields.actor.system.healing_clock.value) - min;
    let max = Number(extraFields.actor.system.healing_clock.max) - min;
    let clockFills = Math.floor((value + tick) / max);
    let newValue = (value + tick) % max;
    let updateObject = {system: {healing_clock: {'==value': min + newValue}}};

    // Update harm
    let harmLevels = ['', 'light', 'medium', 'heavy', 'deadly'];
    updateObject.system.harm = {light: {'==one': '', '==two': ''}};
    if (clockFills > 0)
      for (let [harmId, harmLevel] of Object.entries(harmLevels)) {
        if (harmId == 0) continue;
        let sourceHarmId = Number(harmId) + clockFills;
        let sourceHarmLevel = sourceHarmId >= harmLevels.length ? '' : harmLevels[sourceHarmId];
        updateObject.system.harm[harmLevel] = {'==one': sourceHarmLevel != '' ? extraFields.actor.system.harm[sourceHarmLevel].one : ''};
        if (harmId <= 2)
          updateObject.system.harm[harmLevel]['==two'] = (sourceHarmLevel != '' && sourceHarmId <= 2) ? extraFields.actor.system.harm[sourceHarmLevel].two : '';
      }
    await BladesHelpers.tryUpdate(extraFields.actor, updateObject);

    // Add stress if natural recovery or self-heal
    let naturalRecovery = extraFields.recoverActor.uuid == extraFields.actor.uuid && !extraFields.actor.system.doctor;
    let selfHeal = !naturalRecovery && extraFields.recoverActor.uuid == extraFields.actor.uuid;
    if (naturalRecovery || selfHeal) {
      let resultStress = Math.max(Math.min(Number(extraFields.actor.system.stress.value) + (naturalRecovery ? 1 : 2), extraFields.actor.system.stress.max), 0);
      if (resultStress != extraFields.actor.system.stress.value)
        await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': resultStress}}});
    }
    let recoverActorName = naturalRecovery || selfHeal ? game.i18n.localize('BITD.You') : extraFields.recoverActor.name;

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/recover-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, recoverActorName: recoverActorName, naturalRecovery: naturalRecovery, selfHeal: selfHeal, levelOneHarm: levelOneHarm, tick: tick, clockFills: clockFills, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Salvage roll
  else if (attributeOrRollName == 'BITD.SalvageRoll') {
    // extraFields.salvageVehicle
    if (extraFields.salvageVehicle) {
      let deadlyDamage = extraFields.salvageVehicle.system.damage.deadly.one;
      deadlyDamage += (deadlyDamage ? ', ' : '') + game.i18n.localize('BITD.Salvaged');
      await BladesHelpers.tryUpdate(extraFields.salvageVehicle, {system: {damage: {deadly: {'==one': deadlyDamage}}, '==dead': true}});
      let pilotFull = BladesHelpers.resolveActor(extraFields.salvageVehicle.system.pilot);
      if (pilotFull)
        await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
    }

    let supplyPoints = getBladesRollDowntime(rolls, extraResult, zeromode);

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/salvage-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, supply_points: supplyPoints, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Schmooze roll
  else if (attributeOrRollName == 'BITD.SchmoozeRoll') {
    let trustGain = getBladesRollDowntime(rolls, extraResult, zeromode);
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let trustText = (await BladesHelpers.handleTrust(extraFields.schmoozeFaction, squadFull, trustGain))[0];
    let statusChangeString = '';
    if (trustText)
      statusChangeString = ` ${trustText.includes('<br/>') ? trustText.match('(?<=\<br\/\>)(.*)', 1)[0] : ''}`;

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/schmooze-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, squad: squadFull, trust_gain: trustGain, status_change_string: statusChangeString, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Upkeep roll
  else if (attributeOrRollName == 'BITD.UpkeepRoll') {
    let recoveredQuirks = getBladesRollCutLooseUpkeep(rolls, extraResult, zeromode);
    let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
    let missingQuirks = Object.values(vehicleFull.system.quirks).filter(q => !q.usable).length;
    let recoveredAllQuirks = recoveredQuirks >= missingQuirks;
    if (recoveredAllQuirks) {
      let vehicleUpdateObject = {system: {quirks: {}}};
      for (let quirkId in Object.keys(vehicleFull.system.quirks))
        vehicleUpdateObject.system.quirks[quirkId] = {'==usable': true};
      await BladesHelpers.tryUpdate(vehicleFull, vehicleUpdateObject);
      await BladesHelpers.tryUpdate(extraFields.actor, {'==name': extraFields.actor.name});
    }

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/upkeep-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, materiel: -extraFields.materiel, quirks: recoveredQuirks, recoveredAllQuirks: recoveredAllQuirks, note: note, edge: edge, extraFields: extraFields });
  }
  // Check for Fortune Roll
  else if (attributeOrRollName == 'BITD.FortuneRoll')
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/fortune-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: 'BITD.FortuneRoll', note: note, edge: edge, extraFields: extraFields });
  // Generic roll if not specified
  else {
    // Collection Agency & Side Business: Update Materiel/Personnel
    if (['BITD.CollectionAgency', 'BITD.SideBusiness'].includes(attributeOrRollName)) {
      let factionRelationships = Object.values(extraFields.actor.system.relationships).map(r => { return {actor: BladesHelpers.resolveActor(r.uuid), status: r.status}; }).filter(r => r.actor && r.actor.type == 'faction');
      let minRelationship = factionRelationships.length > 0 ? Math.min(factionRelationships.map(r => Number(r.status)).sort()[0], 0) : 0;
      let value = Math.max(resultDie + minRelationship, 0);
      extraFields.contents = game.i18n.format(extraFields.contents, {value: value});

      let updateObject = {system: {}};
      if (attributeOrRollName == 'BITD.CollectionAgency')
        updateObject.system.materiel = {'==value': Math.min(Math.max(Number(extraFields.actor.system.materiel.value) + value, 0), Number(extraFields.actor.system.materiel.max))};
      else
        updateObject.system.personnel = {'==value': Math.min(Math.max(Number(extraFields.actor.system.personnel.value) + value, 0), Number(extraFields.actor.system.personnel.max))};
      await BladesHelpers.tryUpdate(extraFields.actor, updateObject);
    }
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/generic-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, note: note, edge: edge, extraFields: extraFields });
  }

  let messageData = {
    speaker: speaker,
    content: result,
    rollData: extraFields.rollData,
    rolls: [r]
  }
  await BeamChatMessage.create(messageData);
}

/**
 * Shows Chat message.
 *
 * @param {String} attributeOrRollName
 * @param {string} position
 * @param {string} effect
 */
async function showChatMessage(dice, attributeOrRollName = '', note = '', extraFields = {}) {
  let speaker = ChatMessage.getSpeaker();
  if (extraFields.actor)
    speaker = {
      actor: extraFields.actor._id,
      alias: extraFields.actor.name,
      scene: null,
      token: extraFields.actor.prototypeToken?._id
    };

  let attribute_label = BladesHelpers.getRollLabel(attributeOrRollName);

  // Compute extra text from modifiers
  extraFields.modifier_text = (extraFields.modifier_text ?? '') + computeModifierMessages(extraFields.modifiers);

  let result;
  // Check for Vehicle Resistance
  if (attributeOrRollName == 'BITD.ResistanceRoll') {
    let quirks = getBladesResistanceQuirks(dice);
    let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
    if (!vehicleFull)
      return;
    let currentQuirks = Object.values(vehicleFull.system.quirks).filter(q => q.usable == true).length;
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/resistance-get.html', { attribute_label: attribute_label, quirks: quirks, current_quirks: currentQuirks, note: note, extraFields: extraFields });
  }
  // Check for Enhance
  else if (attributeOrRollName == 'BITD.EnhanceRoll') {
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let enhanceGain = 1 + (squadFull?.system.testing_facilities ? 1 : 0);
    let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
    if (!vehicleFull)
      return;
    let newEnhanceValue = Number(vehicleFull.system.enhance) + enhanceGain;
    let enhanceMaxxed = newEnhanceValue >= Number(vehicleFull.system.enhance_max);
    await BladesHelpers.tryUpdate(vehicleFull, {system: {'==enhance': newEnhanceValue % Number(vehicleFull.system.enhance_max)}});
    await BladesHelpers.tryUpdate(extraFields.actor, {'==name': extraFields.actor.name});
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/enhance-get.html', { num: enhanceGain, enhance_maxxed: enhanceMaxxed, note: note, extraFields: extraFields });
  }
  // Check for Train
  else if (attributeOrRollName == 'BITD.TrainRoll') {
    let squadFull = BladesHelpers.resolveActor(extraFields.actor.system.crew); // TODO: Clean this up a bit, surely there's a way to not have to manually pull from the squad?
    let xpGain = extraFields.actor.system.xp_gain[extraFields.trainType] + (squadFull?.system.modifiers.character?.xp_gain ? (squadFull.system.modifiers.character.xp_gain[extraFields.trainType] ?? 0) : 0);
    let vehicleFull = BladesHelpers.resolveActor(extraFields.actor.system.vehicle);
    let xpActor = ['expertise', 'acuity'].includes(extraFields.trainType) ? vehicleFull : extraFields.actor;
    let xpPath = extraFields.trainType == 'playbook' ? 'system.experience.value' : `system.attributes.${extraFields.trainType}.exp`;
    let newXPValue = Number(extraFields.trainType == 'playbook' ? xpActor.system.experience.value : xpActor.system.attributes[extraFields.trainType].exp) + xpGain;
    let maxXPValue = Number(extraFields.trainType == 'playbook' ? xpActor.system.experience.max : xpActor.system.attributes[extraFields.trainType].exp_max);
    let levelUp = newXPValue >= maxXPValue;
    newXPValue = newXPValue % maxXPValue;
    await BladesHelpers.tryUpdate(xpActor, BladesHelpers.createUpdateObjectFromPath(newXPValue, xpPath));
    if (xpActor != extraFields.actor)
      await BladesHelpers.tryUpdate(extraFields.actor, {'==name': extraFields.actor.name});
    let trainTypeText = game.i18n.localize(`BITD.Actions${BladesHelpers.capitalize(extraFields.trainType)}`);
    let trainTypeDescriptionKey = extraFields.trainType == 'playbook' ? 'BITD.TrainTextGeneral' : ['expertise', 'acuity'].includes(extraFields.trainType) ? 'BITD.TrainTextVehicle' : 'BITD.TrainTextPilot';
    let trainTypeDescription = game.i18n.format(trainTypeDescriptionKey, {trainType: trainTypeText});

    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/train-get.html', { train_type_desc: trainTypeDescription, train_type_text: trainTypeText, num: xpGain, level_up: levelUp, note: note, extraFields: extraFields });
  }
  // Check for Move Base
  else if (attributeOrRollName == 'BITD.MoveBaseRoll')
    result = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/downtime/move-base-get.html', { note: note, extraFields: extraFields });

  let messageData = {
    speaker: speaker,
    content: result
  }
  ChatMessage.create(messageData);
}

export async function cancelRollResult(rollData, actorFull) {
  let squadFull = BladesHelpers.resolveActor(actorFull.system.crew);
  let squadUpdateObject = {};
  if (rollData.realMateriel)
    squadUpdateObject['system.materiel.value'] = Math.min(Math.max(Number(squadFull.system.materiel.value) - rollData.realMateriel, 0), Number(squadFull.system.materiel.max));
  if (rollData.realPersonnel)
    squadUpdateObject['system.personnel.value'] = Math.min(Math.max(Number(squadFull.system.personnel.value) - rollData.realPersonnel, 0), Number(squadFull.system.personnel.max));
  if (Object.keys(squadUpdateObject).length > 0)
    await BladesHelpers.tryUpdate(squadFull, squadUpdateObject);

  for (let [stressChangeId, stressChange] of Object.entries(rollData.stressChanges)) {
    let stressActorFull = BladesHelpers.resolveActor(`Actor.${stressChangeId}`);
    await BladesHelpers.tryUpdate(stressActorFull, {'system.stress.value': Math.min(Math.max(Number(stressActorFull.system.stress.value) - stressChange.realValue, 0), stressActorFull.system.stress.max)});
  }
  for (let [trustChangeId, trustChange] of Object.entries(rollData.trustChanges)) {
    let trustActorFull = BladesHelpers.resolveActor(`Actor.${trustChangeId}`);
    await BladesHelpers.handleTrust(trustActorFull, squadFull, -trustChange.realValue);
  }
  for (let [otherChangeId, otherChangeObj] of Object.entries(rollData.otherChanges)) {
    let otherActorFull = BladesHelpers.resolveActor(`Actor.${otherChangeId}`);
    if (otherActorFull) {
      let updateObject = {};
      for (let [otherPath, otherChange] of Object.entries(otherChangeObj.realValue)) {
        let otherValue = otherActorFull;
        for (let pathPart of otherPath.split('.')) {
          if (!otherValue)
            break;
          otherValue = otherValue[pathPart];
        }
        let resultOther = Math.max(Number(otherValue) - otherChange, 0);
        updateObject[otherPath] = resultOther;
      }
      await BladesHelpers.tryUpdate(otherActorFull, updateObject);
    }
  }

  let actorUpdateObject = {};
  if (rollData.downtime) {
    if (rollData.downtime.value != 0)
      actorUpdateObject['system.downtime_count.value'] = actorFull.system.downtime_count.value - rollData.downtime.value;
    for (let activity of Object.keys(rollData.downtime.activities)) {
      if (activity != 'train_types')
        actorUpdateObject[`system.downtime_activities.${activity}`] = false;
      for (let train_type of Object.keys(rollData.downtime.activities.train_types))
        actorUpdateObject[`system.downtime_activities.train_types.${train_type}`] = false;
    }
  }
  if (Object.keys(actorUpdateObject).length > 0)
    await BladesHelpers.tryUpdate(actorFull, actorUpdateObject);

  for (let [connectionPair, connectionShift] of Object.entries(rollData.connections)) {
    let [ownerId, connectionId] = connectionPair.split('/');
    let ownerFull = BladesHelpers.resolveActor(`Actor.${ownerId}`);
    let connectionFull = BladesHelpers.resolveActor(`Actor.${connectionId}`);
    let connectionIndex = Object.entries(actorFull.system.connections).find(c => c[1].uuid == connectionFull.uuid)[0];
    let connection = actorFull.system.connections[connectionIndex];
    let connectionUpdateObject = {};
    connectionUpdateObject[`system.connections.${connectionIndex}.clock.value`] = Math.min(Math.max(connection.clock.value - connectionShift, 0), 4);
    await BladesHelpers.tryUpdate(ownerFull, connectionUpdateObject);
  }

  for (let modifier of rollData.modifiers) {
    if (modifier.itemNeeded) {
      let exhaustableItems = actor.items.filter(i => i.system[modifier.itemNeeded] && Number(i.system.uses.value) < Number(i.system.uses.max));
      if (exhaustableItems.length > 0)
        await BladesHelpers.tryUpdate(exhaustableItems[exhaustableItems.length - 1], {'system.uses.value': exhaustableItems[exhaustableItems.length - 1].system.uses.value + 1});
    }
    if (modifier.convictionCutLoose)
      await BladesHelpers.tryUpdate(actor, {'system.conviction_uses.value': Math.max(Number(actor.system.conviction_uses.value) - 1, 0)});
    if (modifier.convictionExtra)
      await BladesHelpers.tryUpdate(actor, {'system.conviction_uses.value': Math.min(Number(actor.system.conviction_uses.value) + 1, actor.system.conviction_uses.max)});
  }
}

const rollResultIndex = [ 'failure', 'partial-success', 'success', 'critical-success' ];
/**
 * Get status of the Roll.
 *  - failure
 *  - partial-success
 *  - success
 *  - critical-success
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStatus(rolls, zeromode, modifiers) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();

  let rollStatus, useDie, prevUseDie = false;

  if (zeromode)
    useDie = sortedRolls[0];
  else {
    useDie = sortedRolls[sortedRolls.length - 1];
    if (sortedRolls.length >= 2)
      prevUseDie = sortedRolls[sortedRolls.length - 2];
  }

  // 1,2,3 = failure
  if (useDie <= 3)
    rollStatus = 'failure';
  // if 6 - check the prev highest one.
  else if (useDie === 6) {
    // 6,6 - critical success (not for zeromode)
    if (!zeromode && prevUseDie == 6)
      rollStatus = 'critical-success';
    // 6 - success
    else
      rollStatus = 'success';
  }
  // else (4,5) = partial success
  else
    rollStatus = 'partial-success';

  // Add modifiers effect to the result
  let numberedRollStatus = rollResultIndex.indexOf(rollStatus);
  let extraResult = 0;
  for (let modifier of modifiers)
    if (modifier.result) {
      numberedRollStatus += modifier.result;
      extraResult += modifier.result;
    }
  rollStatus = rollResultIndex[Math.min(Math.max(numberedRollStatus, 0), 3)];

  return [rollStatus, useDie, extraResult];
}

/**
 * Get stress of the Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollResistanceStress(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    result += 1;
  let useDie = Math.max(Math.min(result, 7), 1);
  return 6 - useDie;
}

/**
 * Get quirks to expend for the vehicle resistance check.
 * @param {Number} dice
 */
export function getBladesResistanceQuirks(dice) {
  return Math.max(4 - dice, 1);
}

/**
 * Get Supply Points gained from a Collect Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollCollect(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    result += 1;
  result = Math.max(Math.min(result, 7), 1);
  return result == 7 ? 9 : result;
}

/**
 * Get stress cleared with a Cut Loose Roll and quirks recovered with an Upkeep roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollCutLooseUpkeep(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  result = Math.max(Math.min(result, 6), 1);
  return result;
}

/**
 * Get value used for various Downtime activity rolls.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollDowntime(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let useDie = sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    useDie += 1;
  useDie = Math.max(Math.min(useDie, 7), 1);
  let result = extraResult + (useDie <= 3 ? 1 : useDie < 6 ? 2 : (useDie - 3));
  result = Math.max(Math.min(result, 4), 1);
  return result == 4 ? 5 : result;
}

export function getRollType(rollType, rollTypeLabel, first, single, strict, extraArg) {
  let dialogId = foundry.applications.api.ApplicationV2._appId + 1;
  return `
    <div class="radio-group">
      <label><input type="radio" id="${rollType}-${dialogId}" name="rollSelection"${first ? ' checked' : ''}> ${game.i18n.localize(rollTypeLabel)}</label>
      ${(!single && rollTypeArgs[rollType]) ? rollTypeArgs[rollType](strict, extraArg) : ''}
    </div>`
}

const rollTypeLabels = {
  actionRoll: 'BITD.ActionRoll',
  groupAction: 'BITD.GroupActionRoll',
  resistance: 'BITD.ResistanceRoll',

  fortune: 'BITD.FortuneRoll',
  gatherInfo: 'BITD.GatherInformationRoll',
  engagement: 'BITD.EngagementRoll',
  entanglement: 'BITD.EntanglementRoll',
  supply: 'BITD.SupplyRollFull',

  acquireAsset: 'BITD.AcquireAssetRoll',
  enhance: 'BITD.EnhanceRoll',
  fix: 'BITD.FixRoll',
  manufacture: 'BITD.ManufactureRoll',
  salvage: 'BITD.SalvageRoll',
  upkeep: 'BITD.UpkeepRoll',
  collect: 'BITD.CollectRoll',
  cutLoose: 'BITD.CutLooseRoll',
  longTermProject: 'BITD.LongTermProjectRoll',
  recover: 'BITD.RecoverRoll',
  schmooze: 'BITD.SchmoozeRoll',
  train: 'BITD.TrainRoll',
  moveBase: 'BITD.MoveBaseRoll',

  collectionAgency: 'BITD.CollectionAgency',
  sideBusiness: 'BITD.SideBusiness',

  cohort: 'BITD.CohortRoll'
}

const rollTypeArgs = {
  actionRoll: () => `
    <div>
      <span>
        <label>${game.i18n.localize('BITD.Position')}:</label>
        <select id="pos" name="pos">
          <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
          <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
          <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('BITD.ForcePosition')}:</label>
        <input type="checkbox" id="forcedPos" name="forcedPos">
      </span>
    </div>
    <div>
      <span>
        <label>${game.i18n.localize('BITD.Effect')}:</label>
        <select id="effect" name="effect">
          <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
          <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
          <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('BITD.ForceEffect')}:</label>
        <input type="checkbox" id="forcedEffect" name="forcedEffect">
      </span>
    </div>`,
  entanglement: (_, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Table')}:</label>
      <select id="table" name="table">
        <option value="A" selected>A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
    </span>`,
  acquireAsset: (_, args) => `
    <span>
      <label>${game.i18n.localize('BITD.SuccessTier')}:</label>
      <input type="number" id="acquireAssetSuccessTier" name="acquireAssetSuccessTier" onkeypress="return BladesHelpers.isNumberKey(event)" value="0">
    </span>`,
  collect: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Region')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('BITD.CollectDragDropInfo')}"></i></a>:</label>
      <div id="collectRegion">${game.i18n.localize('BITD.None')}</div>
    </span>
    <span>
      <label>${game.i18n.localize('BITD.Vigilance')}:</label>
      <select id="collectVigilance" name="collectVigilance">
        <option value="0" selected disabled hidden>-0d</option>
        ${Array(11).fill().map((_, i) => `<option value="${i}">-${i}d</option>`).join('')}
      </select>
    </span>`,
  cutLoose: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Connection')}:</label>
      ${args.forcedFields.connection ?
      `<div class="actor-contents flex-horizontal">
        <img src="${args.forcedFields.connection.img}" data-tooltip="${args.forcedFields.connection.name}" width="32" height="32"/>
        <a class="item-name">${args.forcedFields.connection.name}</a>
      </div>` :
      `<select id="connection" name="connection">${args.connectionsText}</select>`}
    </span>`,
  fix: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Fixer')}:</label>
      <select id="fixActor" name="fixActor">${args.healActors}</select>
    </span>`,
  longTermProject: (strict, args) => `
    ${args.actor?.type == 'character' ? `<span>
      <label>${game.i18n.localize('BITD.Action')}:</label>
      <select id="ltpAction" name="ltpAction">${args.actions}</select>
    </span>` : ''}
    <span>
      <label>${game.i18n.localize(`BITD.Project${args.projects.includes('multiple>') ? 's' : ''}`)}:</label>
      <select id="ltpId" name="ltpId"${args.projects}</select>
    </span>`,
  manufacture: (_, args) => `
    <span>
      <label>${game.i18n.localize('BITD.SuccessTier')}:</label>
      <input type="number" id="manufactureSuccessTier" name="manufactureSuccessTier" onkeypress="return BladesHelpers.isNumberKey(event)" value="0">
    </span>
    <span>
      <label>${game.i18n.localize('BITD.Action')}:</label>
      <select id="manufactureAction" name="manufactureAction">
        <option value="engineer" selected>${game.i18n.localize('BITD.ActionsEngineer')}</option>
        <option value="interface">${game.i18n.localize('BITD.ActionsInterface')}</option>
      </select>
    </span>`,
  recover: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Medic')}:</label>
      <select id="recoverActor" name="recoverActor">${args.healActors}</select>
    </span>`,
  salvage: (strict, args) => `
    <span>
      <label>${game.i18n.localize('TYPES.Actor.vehicle')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('BITD.SalvageDragDropInfo')}"></i></a>:</label>
      <div id="salvageVehicle">${game.i18n.localize('BITD.None')}</div>
    </span>`,
  schmooze: (strict, args) => `
    <span>
      <label>${game.i18n.localize('TYPES.Actor.faction')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('BITD.SchmoozeDragDropInfo')}"></i></a>:</label>
      <div id="schmoozeFaction">${game.i18n.localize('BITD.None')}</div>
    </span>
    ${args.actor?.type == 'character' ? `<span>
      <label>${game.i18n.localize('BITD.Action')}:</label>
      <select id="schmoozeAction" name="schmoozeAction">${args.actions}</select>
    </span>`: ''}`,
  supply: (strict, args) => `
    <span>
      <label>${game.i18n.localize('TYPES.Actor.faction')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('BITD.SupplyDragDropInfo')}"></i></a>:</label>
      <div id="supplyFaction">${game.i18n.localize('BITD.None')}</div>
    </span>
    <span>
      <label>${game.i18n.localize('BITD.MissionTier')}:</label>
      <select id="supplyMissionTier" name="supplyMissionTier">
        ${Array(9).fill().map((_, i) => `<option value="${i}"${i == 0 ? ' selected' : ''}>${i}</option>`).join('')}
      </select>
    </span>`,
  train: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Type')}:</label>
      <select id="trainType" name="trainType">${args.trainTypes}</select>
    </span>`,
  upkeep: (strict, args) => `
    <span>
      <label>${game.i18n.localize('BITD.Dice')}:</label>
      <select id="upkeepDice" name="upkeepDice">
        ${Array(args.materiel).fill().map((_, i) => `<option value="${i+1}"${i == 0 ? ' selected' : ''}>${i+1}</option>`).join('')}
      </select>
    </span>`,
  cohort: (_) => `
    <span>
      <label>${game.i18n.localize('BITD.WithinExpertise')}:</label>
      <input type="checkbox" id="expertise" name="expertise" checked>
    </span>`
}

export function buildRollPopup(popupTitle, actor, rollTypes, missingRollTypes = {}, strict = true, forcedFields = {}) {
  let currentStress = 0;
  let currentTier = 0;
  let materiel = 0;
  if (actor) {
    if (actor.type == 'character') {
      currentStress = Number(actor.system.stress.value);
      let squadFull = BladesHelpers.resolveActor(actor.system.crew);
      currentTier = squadFull?.system.tier.value ? Number(squadFull?.system.tier.value) : 0;
      materiel = squadFull?.system.materiel.value ? Number(squadFull?.system.materiel.value) : 0;
    } else if (actor.type == 'crew') {
      currentTier = Number(actor.system.tier.value);
      materiel = Number(actor.system.materiel.value);
    }
  }
  let thirdArg = {actor: actor, forcedFields: forcedFields, currentTier: currentTier, materiel: materiel};

  let missingRollTypesPopup = Object.entries(missingRollTypes).map((v, i) => `<br/>${v[0]}: ${v[1]}`).join('');
  if (missingRollTypesPopup)
    missingRollTypesPopup = game.i18n.localize('BITD.BadRollPopup') + missingRollTypesPopup;

  let rollTypesHTML = '', rollTypesArgs = '';
  for (let rollType of rollTypes) {
    if (rollType == 'cutLoose') {
      let connectionsText = '';
      for (let connection of Object.entries(actor.system.connections)) {
        let entityFull = BladesHelpers.resolveActor(connection[1].uuid);
        if (entityFull)
          connectionsText += `<option value="${entityFull.uuid}"${Number(connection[0]) == 0 ? ' selected' : ''}>${entityFull.name}</option>`
      }
      thirdArg = {...thirdArg, currentStress: currentStress, connectionsText: connectionsText};
    } else if (['fix', 'recover'].includes(rollType)) {
      let healActors = `<option value="${actor.uuid}" selected>${actor.name}${(rollType == 'recover' && !actor.system.doctor) ? ` (${game.i18n.localize('BITD.NoDoctor')})` : ''}</option>`;
      let squadFull = BladesHelpers.resolveActor(actor.system.crew);
      if (squadFull) {
        for (let member of Object.values(squadFull.system.members)) {
          if (member.uuid == actor.uuid) continue;
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (memberFull?.type == 'character' && (rollType == 'fix' || (rollType == 'recover' && memberFull.system.doctor)))
            healActors += `<option value="${memberFull.uuid}">${memberFull.name}</option>`;
        }
        for (let cohortFull of squadFull.items.contents.filter(i => i.type == 'cohort'))
          if (rollType == 'fix' || (rollType == 'recover' && cohortFull.system.type == 'Expert' && cohortFull.system.doctor))
            healActors += `<option value="${cohortFull.uuid}">${cohortFull.name}</option>`;
      }
      thirdArg = {...thirdArg, healActors: healActors};
    } else if (['longTermProject', 'schmooze'].includes(rollType) && actor?.type == 'character') {
      let actionList = Object.keys(actor.getRollData().diceAmount).filter(a => BladesHelpers.isAttributeAction(a));
      // No vehicle: Remove vehicle actions
      if (!BladesHelpers.resolveActor(actor.system.vehicle))
        actionList = actionList.filter(a => !['expertise', 'acuity'].includes(BladesHelpers.getAttributeFromAction(a)));
      let actions = actionList.map((value, index) => `<option value="${value}"${index == 0 ? ' selected' : ''}>${game.i18n.localize(BladesHelpers.getAttributeLabel(value))}</option>`).join('');

      thirdArg = {...thirdArg, actions: actions};
    } else if (rollType == 'train') {
      let trainTypes = ['playbook'];
      let trainTypesText = '';
      for (let [trainTypeName, trainType] of Object.entries(actor.system.attributes))
        // No vehicle: Don't include vehicle attributes
        if (BladesHelpers.resolveActor(actor.system.vehicle) || !trainType.is_vehicle)
          trainTypes.push(trainTypeName);
      for (let usedTrainType of Object.keys(actor.system.downtime_activities.train_types))
        trainTypes.splice(trainTypes.indexOf(usedTrainType), 1);
      trainTypesText = trainTypes.map((t, i) => `<option value="${t}"${i == 0 ? ' selected' : ''}>${game.i18n.localize(`BITD.Actions${BladesHelpers.capitalize(t)}`)}</option>`).join('');
      thirdArg = {...thirdArg, trainTypes: trainTypesText};
    }
    if (rollType == 'longTermProject') {
      let squadFull = BladesHelpers.resolveActor(actor.system.crew);
      let projectList = Object.entries(squadFull.system.projects).filter(p => Number(p[1].clock.value) < Number(p[1].clock.max));
      let projectsString = projectList.map(p => `<option value="${p[0]}"${p[0] == 0 ? ' selected' : ''}>${p[1].title}</option>`).join('');
      projectsString = `${(rollType == 'longTermProject' && squadFull.system.irons_in_the_fire) ? ` data-tooltip="BITD.MultipleSelectUsage" size="${Math.min(projectList.length, 4)}" multiple` : ''}>${projectsString}`;

      thirdArg = {...thirdArg, projects: projectsString};
    }
    rollTypesHTML += getRollType(rollType, rollTypeLabels[rollType], rollTypesHTML.length == 0, rollTypes.length == 1, strict, thirdArg);
    rollTypesArgs += rollTypeArgs[rollType] ? rollTypeArgs[rollType](strict, thirdArg) : '';
  }

  return `
    <h2>${popupTitle}</h2>
    ${!actor ? `<p>${game.i18n.localize('BITD.RollTokenDescription')}</p>` : ''}
    <form>
      <div class="form-group">
        ${!strict ? `<label>${game.i18n.localize('BITD.RollNumberOfDice')}:</label>
        <select id="qty" name="qty">
          <option value="0" selected disabled hidden>0d</option>
          ${Array(14).fill().map((_, i) => `<option value="${i-3}">${i-3}d</option>`).join('')}
        </select>`
        : `<label>${game.i18n.localize('BITD.Modifier')}:</label>
        <select id="mod" name="mod">
          ${createListOfDiceMods(-3, +3, 0)}
        </select>`}
      </div>
      <fieldset class="form-group"${rollTypes.length == 1 ? ' hidden' : ''}>
        <legend>${game.i18n.localize('BITD.RollTypes')}${missingRollTypesPopup ? ` <i class="fas fa-question-circle" data-tooltip="${missingRollTypesPopup}"></i>` : ''}</legend>
        ${rollTypesHTML}
      </fieldset>
      ${(rollTypesArgs != '' && rollTypes.length == 1) ? `
      <fieldset class="form-group">
        <legend>${game.i18n.localize('BITD.Arguments')}</legend>
        ${rollTypesArgs}
      </fieldset>` : ''}
      <fieldset class="form-group toggleable-modifiers">
        <legend>${game.i18n.localize('BITD.ToggleableModifiers')}</legend>
      </fieldset>
      <div class="form-group">
        <label>${game.i18n.localize('BITD.Notes')}:</label>
        <input id="note" name="note" type="text" value="">
      </div>
    </form>`;
}

/**
 * Call a Roll popup.
 */
export async function simpleRollPopup(title1 = 'BITD.SimpleRoll', title2 = 'BITD.RollSomeDice', forcedActor = null, strict = false) {
  let selectedTokens = canvas.tokens.controlled;
  let targetActor = forcedActor;
  if (!targetActor && selectedTokens.length > 0)
    targetActor = game.actors.get(selectedTokens[0].document.actorId);

  // Fetch roll modifiers (if an Actor was selected)
  let allPermanentModifiers = [];
  let allConditionalModifiers = [];
  let _;
  if (targetActor) {
    [_, allPermanentModifiers, allConditionalModifiers] = targetActor.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, targetActor);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, targetActor);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(targetActor, allConditionalModifiers);
  }

  let rollTypes = ['engagement', 'entanglement', 'fortune', 'gatherInfo', 'supply'];
  let dialog = new foundry.applications.api.DialogV2({
    window: { title: `${game.i18n.localize(title1)}` },
    content: buildRollPopup(game.i18n.localize(title2), targetActor, rollTypes, {}, strict),
    buttons: [
      {
        icon: 'fas fa-check',
        label: game.i18n.localize('BITD.Roll'),
        action: 'roll',
      },
      {
        icon: 'fas fa-times',
        label: game.i18n.localize('Cancel'),
        action: 'cancel',
      }
    ],
    submit: async (result, dialog) => {
      if (result != 'roll') return;

      let diceQty = Number(dialog.element.querySelector('[name="qty"]').value);
      let note = dialog.element.querySelector('[name="note"]').value;

      // Fetch actor roll modifiers & enabled conditional roll modifiers
      let enabledConditionalModifiers = resolveConditionalModifiers(dialog, targetActor);
      enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

      let input = dialog.element.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: targetActor };
        switch (rollType) {
          case 'engagement':
            await bladesRoll(diceQty, 'BITD.EngagementRoll', note, extraFields);
            break;
          case 'entanglement':
            let table = dialog.element.querySelector('[name="table"]').value;
            extraFields.table = table;
            await bladesRoll(diceQty, 'BITD.EntanglementRoll', note, extraFields);
            break;
          case 'fortune':
            await bladesRoll(diceQty, 'BITD.FortuneRoll', note, extraFields);
            break;
          case 'gatherInfo':
            await bladesRoll(diceQty, 'BITD.GatherInformationRoll', note, extraFields);
            break;
          case 'supply':
            let supplyFactionUuid = dialog.element.querySelector('#supplyFaction > .actor-contents')?.dataset.actorId;
            let supplyFactionFull = BladesHelpers.resolveActor(supplyFactionUuid);
            extraFields.supplyFaction = supplyFactionFull;
            let supplyMissionTier = Number(dialog.element.querySelector('[name="supplyMissionTier"]').value);
            let supplyDice = supplyMissionTier;
            let squadFull = BladesHelpers.resolveActor(targetActor?.system.crew);
            if (squadFull && supplyFactionFull) {
              let factionRelationship = BladesHelpers.fetchRelationship(supplyFactionFull, squadFull);
              if (factionRelationship)
                supplyDice += Number(factionRelationship.status);
            }
            await bladesRoll(supplyDice + diceQty, 'BITD.SupplyRoll', note, extraFields);
            break;
        }
        if (targetActor)
          await postRollProcessing(targetActor, extraFields);
      }
    }
  });
  dialog.allPermanentModifiers = allPermanentModifiers;
  dialog.allConditionalModifiers = allConditionalModifiers;
  dialog.attributeName = '';
  dialog.rollTypes = rollTypes;
  dialog._onFirstRender = dialogOnFirstRender;
  dialog._onRender = function(context, options) {
    dialogOnRender(context, options, this);

    let allowedToRoll = true;
    allowedToRoll &&= checkDowntimeRules(this);
    this.element.querySelector('[data-action="roll"]').disabled = !allowedToRoll;
  };
  dialog.refreshModifiers = refreshModifiers;
  dialog.actor = targetActor;
  await dialog.render(true);

  dialog.element.ondrop = async function(ev) {
    ev.preventDefault();
    const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
    if (dropData.uuid) {
      let dropFull = BladesHelpers.resolveActor(dropData.uuid);
      if (dropFull.type == 'faction') {
        // Drop a Faction for the Supply roll
        this.querySelector('#supplyFaction').innerHTML = `
          <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
            <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
            <a class="item-name">${dropFull.name}</a>
            <a class="delete-actor"><i class="fas fa-times"></i></a>
          </div>`;
        this.querySelector('#supplyFaction .delete-actor').onclick = function (ev) {
          this.closest('#supplyFaction').innerHTML = game.i18n.localize('BITD.None');
        }
      }
    }
  };
}

export function dialogOnFirstRender(context, options, thisPass) {
  let dialog = this ?? thisPass;
  let query = dialog.element.querySelectorAll('.radio-group input[type=radio]');
  let position = dialog.element.querySelector('[name="effect"]');
  for (let el of query) {
    el.addEventListener('click', (event) => {
      dialog.refreshModifiers(dialog, event.target.id.split('-')[0], position?.value, dialog.attributeName);

      let rollButton = dialog.element.querySelectorAll('button[data-action=roll]')[0];
      let rollType = el.id.split('-')[0];
      let buttonAvailable = true;
      if (rollType == 'cutLoose') {
        let connections = dialog.element.querySelector('select[name=connection]');
        buttonAvailable = connections.innerHTML.length != 0;
      }
      rollButton.disabled = !buttonAvailable;
    });
  }
  dialog.refreshModifiers(dialog, dialog.rollTypes[0], position?.value, dialog.attributeName);
}

export function dialogOnRender(context, options, thisPass) {
  let dialog = this ?? thisPass;
  let position = dialog.element.querySelector('[name="effect"]');
  dialog.refreshModifiers(dialog, dialog.rollTypes[0], position?.value, dialog.attributeName);
}

export function refreshModifiers(dialog, rollType, rollPosition, attributeName) {
  dialog.permanentModifiers = keepValidModifiersFromRollType(dialog.allPermanentModifiers, rollType, rollPosition, attributeName);
  dialog.conditionalModifiers = keepValidModifiersFromRollType(dialog.allConditionalModifiers, rollType, rollPosition, attributeName);
  let newConditionalModifiersHTML = buildConditionalModifiersHTML(dialog.conditionalModifiers, dialog.actor);
  dialog.element.querySelector('.toggleable-modifiers').innerHTML = newConditionalModifiersHTML;
  dialog.element.querySelector('.toggleable-modifiers').style.display = Object.entries(dialog.conditionalModifiers.filter(m => !m.hidden)).length == 0 ? 'none' : '';
}

export function getRollModifiers(actor) {
  let modifiers = actor.system.roll_modifiers;
  if (actor.system.crew) {
    let squadFull = BladesHelpers.resolveActor(actor.system.crew);
    // Fetch crew-level modifiers applying to the character
    if (squadFull?.system.roll_modifiers.character !== undefined)
      modifiers = {...modifiers, ...squadFull.system.roll_modifiers.character};
  }

  let output = [];
  if (modifiers)
    for (let [key, value] of Object.entries(modifiers))
      if (value === true)
        output.push(bladesRollModifierList[key]);
  return output;
}

/**
 * Creates <options> modifiers for dice roll.
 *
 * @param {int} rs Min die modifier
 * @param {int} re Max die modifier
 * @param {int} s Selected die
 */
function createListOfDiceMods(rs, re, s) {
  var text = ``;
  var i = 0;

  if (s == '')
    s = 0;

  for (i = rs; i <= re; i++)
    text += `<option value="${i}"${i == s ? ' selected' : ''}>${i >= 0 ? '+' : ''}${i}d</option>`;

  return text;
}

export function keepValidModifiersFromRollType(modifiers, rollType, rollPosition, attributeName) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.rollType && modifier.rollType != rollType) continue;
    if (modifier.rollTypes && !modifier.rollTypes.includes(rollType)) continue;
    if (modifier.notRollTypes && modifier.notRollTypes.includes(rollType)) continue;
    if (modifier.rollPosition && modifier.rollPosition != rollPosition) continue;
    if (modifier.attributeName && modifier.attributeName != attributeName) continue;
    if (modifier.attributesName && !modifier.attributesName.includes(attributeName)) continue;
    output.push(modifier);
  }
  return output;
}

export function keepValidModifiersFromStatus(modifiers, rollStatus) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.rollStatus && !modifier.rollStatus.includes(rollStatus))continue;
    output.push(modifier);
  }
  return output;
}

export function keepValidModifiersFromOther(modifiers) {
  let output = [];
  let pushingYourself = false;
  for (let modifier of modifiers) {
    if (modifier.pushYourself) pushingYourself = true;
    if (modifier.needPushYourself && !pushingYourself) continue;
    output.push(modifier);
  }
  return output;
}

function computeModifierMessages(modifiers) {
  let output = '';
  for (let modifier of modifiers)
    if (modifier.rollText)
      output += `<p>${game.i18n.format(modifier.rollText, modifier.rollTextArgs ?? {})}</p>`;
  return output;
}

export async function resolveRollModifierArray(modifiers, actor, attributeName) {
  let output = [];
  if (modifiers)
    for (let [key, value] of Object.entries(modifiers)) {
      if (value === true)
        if (Object.keys(bladesRollModifierList).includes(key)) {
          let result = foundry.utils.deepClone(bladesRollModifierList[key]);
          result.key = key;
          if (result.push_yourself) {
            // Push Yourself: Choose the right cost
            if (actor.type != 'character') continue;
            let attribute = BladesHelpers.getAttributeFromAction(attributeName);
            let isVehicleAction = ['expertise', 'acuity'].includes(attribute) || ['expertise', 'acuity'].includes(attributeName);
            if (actor.system.travelling_companion && isVehicleAction)
              result.fields['BITD.Cost'] = ['BITD.Quirks', 'BITD.Stress'];
            else
              result.fields['BITD.Cost'] = undefined;
          } else if (result.assist) {
            // Assist: List all Connections from other Pilots with at least 1 tick
            if (actor.type != 'character') continue;
            result.fields['BITD.Connection'] = {};
            for (let connection of BladesHelpers.fetchConnectionsToActor(actor.uuid)) {
              if (connection.clock.value < 1) continue;
              let characterFull = BladesHelpers.resolveActor(connection.uuid);
              if (characterFull?.type != 'character') continue;
              result.fields['BITD.Connection'][characterFull.uuid] = characterFull.name;
            }
            if (!Object.values(result.fields['BITD.Connection']).length) continue;
          } else if (result.telepathy) {
            // Telepathy: List all squadmates who own the Ability
            await actor.updateCrewWideAbilityOwnership(actor);
            if (!actor.system.telepathy_owners) continue;
            if (!actor.system.telepathy_owners.length) continue;
            result.fields['BITD.User'] = [];
            for (let owner of actor.system.telepathy_owners) {
              let ownerFull = BladesHelpers.resolveActor(owner);
              result.fields['BITD.User'].push(ownerFull.name);
            }
          } else if (result.crowdsource) {
            // Crowdsource: List all squadmates except yourself
            if (!actor.system.crew) continue;
            let squadFull = BladesHelpers.resolveActor(actor.system.crew);
            if (!squadFull) continue;
            if (Object.values(squadFull.system.members).length == 1) continue;
            result.fields['BITD.Crewmate'] = {};
            for (let character of Object.values(squadFull.system.members)) {
              if (character.uuid == actor.uuid) continue;
              let characterFull = BladesHelpers.resolveActor(character.uuid);
              if (characterFull.type != 'character') continue;
              result.fields['BITD.Crewmate'][character.uuid] = characterFull.name;
            }
          } else if (result.downtime_assist) {
            // Downtime Assist: List all Pilot Squad Members, Pilot Connections and Cohorts
            if (actor.type != 'character') continue;
            result.fields['BITD.Helper'] = {};
            let squadFull = BladesHelpers.resolveActor(actor.system.crew);
            if (squadFull) {
              for (let member of Object.values(squadFull.system.members)) {
                if (member.uuid == actor.uuid) continue;
                let characterFull = BladesHelpers.resolveActor(member.uuid);
                if (characterFull.type != 'character') continue;
                result.fields['BITD.Helper'][characterFull.uuid] = characterFull.name;
              }
            }
            for (let connection of Object.values(actor.system.connections)) {
              let characterFull = BladesHelpers.resolveActor(connection.uuid);
              if (characterFull?.type != 'character') continue;
              result.fields['BITD.Helper'][characterFull.uuid] = characterFull.name;
            }
            if (squadFull)
              for (let cohort of squadFull.items.filter(i => i.type == 'cohort'))
                result.fields['BITD.Helper'][cohort.uuid] = cohort.name;
            result.fields['BITD.Helper'][''] = 'BITD.Other';
          } else if (result.needsRealWorkshop) {
            let squadFull = actor.type == 'crew' ? actor : BladesHelpers.resolveActor(actor.system.crew);
            if (!squadFull?.system.real_workshop) continue;
          }
          output.push(result);
        } else
          console.error(`Unknown modifier '${key}'`);
    }
  return output;
}

export function pruneInvalidConditionalRollModifiers(actorFull, modifiers) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.invalid) continue;
    if (modifier.itemNeeded && actorFull.items)
      if (actorFull.items.filter(i => i.system[modifier.itemNeeded] && (i.system.uses.max == i.system.uses.value || i.system.uses.value > 0)).length == 0) continue;
    if (modifier.convictionExtra && (!actorFull || actorFull.system.conviction_uses?.value == 0)) continue;
    if (modifier.terminator) {
      let ownerFull = BladesHelpers.resolveActor(actorFull.system.owner);
      if (!ownerFull) continue;
      if (!ownerFull.items.find(i => i.system.terminator)) continue;
    }
    if (modifier.cohortGangType)
      if (actorFull.system.type != 'Gang' || actorFull.system.gang_type == undefined || !actorFull.system.gang_type.includes(modifier.cohortGangType)) continue;
    if (modifier.factionTrust) {
      let squadFull = BladesHelpers.resolveActor(actorFull.system.crew);
      if (!squadFull?.system.faction) continue;
      let factionFull = BladesHelpers.resolveActor(squadFull.system.faction);
      if (!factionFull) continue;
    }
    if (modifier.materiel || modifier.personnel) {
      let squadFull = BladesHelpers.resolveActor(actorFull.system.crew);
      if (!squadFull) continue;
    }
    if (modifier.needsRegion) {
      let regionFull = BladesHelpers.resolveActor(actorFull.system.region);
      if (!regionFull) continue;
    }
    if (modifier.checkFunc) {
      let extraData = {actorFull: actorFull};
      if (!modifier.checkFunc(extraData))
        continue;
    }
    output.push(modifier);
  }
  return output;
}

export function buildConditionalModifiersHTML(modifiers, actorFull) {
  let output = `<legend>${game.i18n.localize('BITD.ToggleableModifiers')}</legend>`;
  for (let [id, modifier] of Object.entries(modifiers)) {
    if (modifier.hidden) continue;
    if (modifier.nameArgs)
      modifier.nameArgs = parseNameArgs(modifier.nameArgs, actorFull);
    let title = modifier.nameArgs ? game.i18n.format(modifier.name, modifier.nameArgs) : game.i18n.localize(modifier.name);
    output += `<div class="modifier" data-modifier="${modifier.key}" data-modifier-id=${id}><label><input type="checkbox"> ${title}</label>`;
    if (modifier.fields) {
      for (let [fieldName, fieldDataArray] of Object.entries(modifier.fields)) {
        if (fieldDataArray == undefined)
          continue;
        output += `<span><label>${game.i18n.localize(fieldName)}</label>`
        if (fieldDataArray == true || fieldDataArray == false)
          output += `<input type="checkbox" name="${fieldName}" ${fieldDataArray ? ' checked' : ''}>`;
        else if (fieldDataArray instanceof Array) {
          let first = true;
          let multiple = fieldName == 'BITD.Effects';
          output += `<select field="${fieldName}"${multiple ? ' data-tooltip="BITD.MultipleSelectUsage" multiple': ''}>`
          for (let fieldData of fieldDataArray) {
            output += `<option value="${fieldData}" ${first ? 'selected' : ''}>${game.i18n.localize(fieldData)}</option>`;
            first = false;
          }
          output += '</select>';
        } else {
          let first = true;
          let multiple = fieldName == 'BITD.Effects';
          output += `<select field="${fieldName}"${multiple ? ' data-tooltip="BITD.MultipleSelectUsage" multiple': ''}>`
          for (let [fieldDataInternal, fieldData] of Object.entries(fieldDataArray)) {
            output += `<option value="${fieldDataInternal}" ${first ? 'selected' : ''}>${game.i18n.localize(fieldData)}</option>`;
            first = false;
          }
          output += '</select>';
        }
        output += '</span>';
      }
    }
    output += '</div>';
  }
  return output;
}

function parseNameArgs(nameArgs, actorFull) {
  if (!actorFull) return nameArgs;

  let output = {};
  for (let [argName, argValue] of Object.entries(nameArgs)) {
    let processedArg = '';
    for (let [id, val] of Object.entries(argValue.split('{'))) {
      if (id == 0) {
        processedArg = val;
        continue;
      }
      let [key, rest] = val.split('}', 1);
      let keyData = actorFull;
      for (let pathPart of key.split('.')) {
        keyData = keyData[pathPart];
        if (Array.isArray(keyData) || keyData == null) {
          keyData == 'undefined';
          break;
        } else if (typeof keyData == 'string' && keyData.startsWith('Actor')) {
          keyData = BladesHelpers.resolveActor(keyData);
          if (!keyData) {
            keyData = 'undefined';
            break;
          }
        }
      }
      processedArg += String(keyData) + (rest ?? '');
    }
    output[argName] = processedArg;
  }
  return output;
}

export function resolveConditionalModifiers(dialog, actorFull, attributeName) {
  let checkedModifiers = dialog.element.querySelectorAll('.modifier:has(label > input[type=checkbox]:checked)')
  let output = [];
  for (let checkedModifier of checkedModifiers) {
    let conditionalModifier = foundry.utils.deepClone(dialog.conditionalModifiers[parseInt(checkedModifier.dataset.modifierId)]);

    if (conditionalModifier.resolveFunc !== undefined) {
      let fields = {};
      let selectElements = checkedModifier.querySelectorAll('span > select');
      for (let select of selectElements)
        fields[select.attributes.field.value] = $(select).val();
      let checkboxElements = checkedModifier.querySelectorAll('span > input[type=checkbox]');
      for (let checkbox of checkboxElements)
        fields[checkbox.attributes.name.value] = checkbox.checked;

      let extraData = {actorFull: actorFull};
      if (actorFull.system.crew) {
        let squadFull = BladesHelpers.resolveActor(actorFull.system.crew);
        let groupAction = squadFull?.system.group_action;
        if (groupAction) {
          let leaderFull = BladesHelpers.resolveActor(groupAction.leader);
          extraData.leader = leaderFull.name;
        }
      }
      let attribute = BladesHelpers.getAttributeFromAction(attributeName);
      extraData.isVehicle = ['expertise', 'acuity'].includes(attribute) || ['expertise', 'acuity'].includes(attributeName);
      conditionalModifier = conditionalModifier.resolveFunc(fields, extraData);
      if (!conditionalModifier)
        continue;
    }

    // Telepathy: Use the leader's action rating instead of the current player's
    if (conditionalModifier.telepathy && actorFull.system.crew) {
      let squadFull = BladesHelpers.resolveActor(actorFull.system.crew);
      let groupAction = squadFull?.system.group_action;
      if (groupAction) {
        // Don't let the leader use the ability
        if (groupAction.leader == actorFull.uuid) continue;
        let actorActionRating = actorFull.getRollData().diceAmount[groupAction.action];
        conditionalModifier.dice = groupAction.leader_action - actorActionRating;
      }
    }

    // Crowdsource: Use the selected crewmate's action rating instead of the current player's
    if (conditionalModifier.crowdsource) {
      let targetFull = BladesHelpers.resolveActor(conditionalModifier.target);
      let actorActionRating = actorFull.getRollData().diceAmount[dialog.attributeName];
      conditionalModifier.dice = targetFull.getRollData().diceAmount[dialog.attributeName] - actorActionRating;
    }

    output.push(conditionalModifier);
  }

  // Fetch hidden, always on modifiers
  for (let modifier of dialog.allConditionalModifiers)
    if (modifier.hidden)
      output.push(modifier);

  return output;
}

// Downtime Rules: Prevent roll if not enough Downtime Activities if Strict
export function checkDowntimeRules(dialog) {
  if (game.settings.get('beamsaber', 'DowntimeRules') == 'strict' && dialog.actor) {
    let enabledConditionalModifiers = resolveConditionalModifiers(dialog, dialog.actor);
    enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);
    let modifiers = [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ];

    if (dialog.actor.type == 'character') {
      let input = dialog.element.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        let downtimeCountChanges = rollType ? (BladesHelpers.isDowntime(rollType) ? -1 : 0) : 0;
        for (let modifier of modifiers) {
          if (modifier.bonusRoll) {
            downtimeCountChanges = 0;
            extraFields.bonusRoll = true;
          }
          if (modifier.downtime) downtimeCountChanges += modifier.downtime;
        }

        if (-downtimeCountChanges > dialog.actor.system.downtime_count.value)
          return false;
      } else
        return false;
    } else if (dialog.actor.type == 'crew') {
      // Cohort Rolls
      if (dialog.actor.system.cohort_downtime_done)
        return false;
    }
  }
  return true;
}

export async function postRollProcessing(actor, extraFields) {
  // Decrease uses for itemNeeded modifiers
  for (let modifier of extraFields.modifiers) {
    if (modifier.itemNeeded) {
      let exhaustableItems = actor.items.filter(i => i.system[modifier.itemNeeded] && i.system.uses.value > 0);
      if (exhaustableItems.length > 0)
        await BladesHelpers.tryUpdate(exhaustableItems[0], {system: {uses: {'==value': exhaustableItems[0].system.uses.value - 1}}});
    }
    if (modifier.convictionCutLoose)
      await BladesHelpers.tryUpdate(actor, {system: {conviction_uses: {'==value': Math.min(Number(actor.system.conviction_uses.value) + 1, actor.system.conviction_uses.max)}}});
    if (modifier.convictionExtra)
      await BladesHelpers.tryUpdate(actor, {system: {conviction_uses: {'==value': Math.max(Number(actor.system.conviction_uses.value) - 1, 0)}}});
  }
}

export async function computeGroupActionResultAndSendMessage(groupActionData, crew) {
  let action_label = BladesHelpers.getRollLabel(groupActionData.action);
  let attribute = BladesHelpers.getAttributeFromAction(groupActionData.action);
  let isVehicleAction = ['expertise', 'acuity'].includes(attribute);

  if (Object.values(groupActionData.rolls).length == 0) {
    ui.notifications.warn(game.i18n.localize('BITD.log.warn.GroupActionNoRollsToParse'));
    return;
  }

  let result = Object.values(groupActionData.rolls).sort((a, b) => rollResultIndex.indexOf(b) - rollResultIndex.indexOf(a))[0];
  let resultOccurrences = Object.values(groupActionData.rolls).reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {});

  // Synchronised: Count separate 6s (success) for a critical success
  if (crew.system.modifiers.synchronised && result == 'success' && resultOccurrences['success'] >= 2)
    result = 'critical-success';

  let leaderFull = BladesHelpers.resolveActor(groupActionData.leader);
  let stress = resultOccurrences['failure'] ?? 0;
  let quirks = groupActionData.rolls[leaderFull.id] == 'failure' ? 1 : 0;
  quirks += stress > quirks ? 1 : 0;

  // Expertise: If leader's selected action, max stress at 1
  for (let expertise of leaderFull.items.filter(i => i.system.expertise == true))
    if (expertise.system.expertise_action == groupActionData.action) {
      stress = Math.min(stress, 1);
      break;
    }

  if (!isVehicleAction) {
    let resultStress = Math.max(Math.min(Number(leaderFull.system.stress.value) + stress, Number(leaderFull.system.stress.max)), 0);
    if (resultStress != leaderFull.system.stress.value)
      await BladesHelpers.tryUpdate(leaderFull, {system: {stress: {'==value': resultStress}}});
  }

  let messageData = {
    speaker: ChatMessage.getSpeaker(),
    content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/group-action-result.html', { action: action_label, position: groupActionData.position, effect: groupActionData.effect, is_vehicle_action: isVehicleAction, roll_status: result, leader_name: leaderFull.name, stress: stress, quirks: quirks, note: groupActionData.note })
  };
  ChatMessage.create(messageData);
}