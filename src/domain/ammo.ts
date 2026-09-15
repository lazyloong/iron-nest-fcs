/**
 * 铁巢重炮 · 弹药数据
 *
 * 数据来源：哔哩哔哩 WIKI `模块:弹药数据`（Lua 纯数据模块）。
 * 爆炸半径单位是「格」——即战术地图大格子边长，1 格 = 1 km。
 * 装药档位、仰角、弹速与飞行时间**与弹种无关**，所有弹种共用同一套弹道模型。
 */

export interface Ammo {
  /** 弹药代号，同时对应贴图名 */
  id: string;
  name: string;
  /** 弹药类型 */
  type: string;
  /** 征用点消耗 */
  cost: number;
  /** 是否穿甲（打装甲目标/工事必需） */
  armorPiercing: boolean;
  /** 伤害等级；无杀伤弹种为 undefined */
  damage?: number;
  /** 爆炸半径，单位：格（1 格 = 1 km） */
  blastRadius: number;
  /** 特殊效果说明 */
  effect?: string;
  /** 起火/蔓延概率说明 */
  spreadChance?: string;
  /** 首次解锁的关卡或模式 */
  unlock: string;
  /** 描述 */
  description: string;
  /** 备注 */
  note?: string;
}

export const AMMO_LIST: readonly Ammo[] = [
  {
    id: "AP",
    name: "AP弹",
    type: "穿甲",
    cost: 10,
    armorPiercing: true,
    damage: 2,
    blastRadius: 0.15,
    unlock: "第 2 关「炮火与光辉」",
    description: "穿甲弹，最少装药。最小爆炸范围。",
  },
  {
    id: "APHE",
    name: "APHE弹",
    type: "穿甲高爆",
    cost: 15,
    armorPiercing: true,
    damage: 2,
    blastRadius: 0.25,
    unlock: "第 11 关「敌人如潮」",
    description: "穿甲弹，中等装药。中等爆炸范围。",
  },
  {
    id: "ATMC",
    name: "ATMC弹",
    type: "实验核弹",
    cost: 666,
    armorPiercing: false,
    damage: 2,
    blastRadius: 3,
    unlock: "第 14 关「最终收割」",
    description: "实验性裂变核炮弹。理论上可引发持续链式反应。效果未经测试。",
    note: "限 1 发",
  },
  {
    id: "CLMN",
    name: "CLMN弹",
    type: "集束",
    cost: 17,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.5,
    unlock: "挑战模式（专属）",
    description: "集束弹，落地后散射六枚HE子母弹。对步兵与载具有效。",
  },
  {
    id: "CYAN",
    name: "CYAN弹",
    type: "毒气",
    cost: 28,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.75,
    unlock: "第 14 关「最终收割」",
    description: "氰气弹。对开阔地带单位致命，工事内单位无影响。",
  },
  {
    id: "DRIL",
    name: "DRIL弹",
    type: "训练",
    cost: 3,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.07,
    unlock: "第 6 关「卡塔赫纳之围」",
    description: "训练弹。混凝土填充，无爆炸物。极小有效半径。",
  },
  {
    id: "EQKE",
    name: "EQKE弹",
    type: "穿甲深钻",
    cost: 26,
    armorPiercing: true,
    damage: 2,
    blastRadius: 0.55,
    unlock: "第 15 关「白色炮弹」",
    description: "穿甲弹，深侵彻地下延时起爆。较大爆炸范围。",
  },
  {
    id: "FLCH",
    name: "FLCH弹",
    type: "箭霰",
    cost: 20,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.62,
    effect: "仅对步兵单位致命；对坦克/载具等机动化部队无效。",
    unlock: "第 12 关「孤独发炮」",
    description: "箭矢弹。有效范围大。仅对开阔地带无防护步兵致命。",
  },
  {
    id: "HCHE",
    name: "HCHE弹",
    type: "高爆",
    cost: 18,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.55,
    unlock: "第 4 关「反炮兵」",
    description: "高装药高爆弹。薄弹壁，最大爆炸装药。大爆炸半径。",
  },
  {
    id: "HE",
    name: "HE弹",
    type: "高爆",
    cost: 10,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.25,
    effect: "标准高爆。",
    unlock: "第 1 关「校射」",
    description: "中等装药高爆弹。中等爆炸范围。",
  },
  {
    id: "INCN",
    name: "INCN弹",
    type: "燃烧",
    cost: 12,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.25,
    effect: "落地起火；5 秒后随机分支判定是否蔓延。",
    spreadChance: "50%（命中 5 秒后判定；新火点离落点约 0.45 格，方向随机）",
    unlock: "第 3 关「解放」",
    description: "燃烧弹。落地时引发火灾，中等半径。有一定概率会蔓延。",
  },
  {
    id: "LE",
    name: "LE弹",
    type: "低威力爆弹",
    cost: 8,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.15,
    unlock: "第 7 关「峡谷要冲」",
    description: "中等装药小威力爆炸弹。小爆炸半径。",
  },
  {
    id: "PCLM",
    name: "PCLM弹",
    type: "伞降集束",
    cost: 15,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.15,
    effect: "初始伤害 + 5 次错落子爆炸（每次间隔 10 秒）。",
    unlock: "第 10 关「火力支援」",
    description: "伞降延时集束弹。内含六枚HE子母弹。间隔 10 秒依次起爆。",
    note: "5 枚子母弹落在离第一次落点 0.2～0.6 格的圆环里、方向随机。",
  },
  {
    id: "PHGN",
    name: "PHGN弹",
    type: "光气",
    cost: 10,
    armorPiercing: false,
    damage: 2,
    blastRadius: 0.62,
    effect:
      "驱离 + 揭示隐藏；已压制单位 → 2 点伤害（致死），未压制单位 → 仅驱离、不杀伤。",
    unlock: "第 8 关「居高临下」",
    description:
      "光气窒息毒气弹。单位会逃离烟云范围。如被压制则造成范围内人员死亡。",
    note: "伤害 2 仅对被压制单位生效。",
  },
  {
    id: "PRPG",
    name: "PRPG弹",
    type: "宣传",
    cost: 7,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.5,
    effect: "对压制的单位概率策反（66.7%）。",
    unlock: "第 12 关「孤独发炮」",
    description:
      "宣传弹。凭借卡斯蒂利亚的荣光在心理上威慑敌军，有一定概率会诱发逃兵。",
  },
  {
    id: "SMK",
    name: "SMK弹",
    type: "烟雾",
    cost: 2,
    armorPiercing: false,
    blastRadius: 1,
    unlock: "第 5 关「钢铁之路」",
    description: "掩护用烟雾弹。无杀伤性，友军单位将向落点推进。",
    note: "无伤害节点。",
  },
  {
    id: "STAR",
    name: "STAR弹",
    type: "照明",
    cost: 2,
    armorPiercing: false,
    blastRadius: 0.5,
    unlock: "第 1 关「校射」",
    description: "伞降延时照明弹。照亮目标区域以进行侦察。",
  },
  {
    id: "TEAR",
    name: "TEAR弹",
    type: "催泪",
    cost: 8,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.75,
    effect: "压制 + 揭示隐藏单位；无杀伤。",
    unlock: "第 8 关「居高临下」",
    description: "氯苯乙酮催泪弹。压制敌方单位，并迫使隐藏单位显身。",
  },
  {
    id: "THRM",
    name: "THRM弹",
    type: "高温燃烧",
    cost: 22,
    armorPiercing: false,
    damage: 1,
    blastRadius: 0.35,
    effect: "伤害 1 + 三次错落起火（6/12/24 秒）。",
    spreadChance:
      "100%（必触发：+6/+12/+24 秒各起 1 次火，新火点离落点 0.4 格，方向随机）",
    unlock: "第 13 关「幽灵炮台」",
    description: "高温燃烧弹。命中后引燃大范围火灾。火势大概率会蔓延。",
  },
  {
    id: "WP",
    name: "WP弹",
    type: "白磷",
    cost: 10,
    armorPiercing: false,
    damage: 2,
    blastRadius: 0.75,
    effect:
      "驱离 + 揭示隐藏；已压制单位 → 2 点伤害（致死），未压制单位 → 仅驱离、不杀伤；另有概率起火。",
    spreadChance: "50%（命中 10 秒后判定；火点离落点 0.6 格，方向随机）",
    unlock: "第 9 关「盲区推算」",
    description:
      "白磷弹。受影响单位会逃离烟云范围，若被压制则造成人员死亡。有一定概率会引发火灾。",
    note: "伤害 2 仅对被压制单位生效。",
  },
];

export function findAmmo(id: string): Ammo | undefined {
  return AMMO_LIST.find((a) => a.id === id);
}
