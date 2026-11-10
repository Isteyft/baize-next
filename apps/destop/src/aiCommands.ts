import type { JsonDataset, ProjectModGroupKey } from '@baize-next/types'

import { getGroupEnumOptions, GROUP_META_ENUM_FIELDS } from './utils/json'
import { getSeidDefinitions, getSeidPropertyOptions, type SeidDrawerRecords, type SeidMetaDefinition } from './utils/seid'

/** 一条 slash 指令。 */
export interface AiCommand {
    /** 指令标识，例如 buff。 */
    id: string
    /** 触发关键词（不含斜杠），例如写buff。 */
    keyword: string
    /** 指令名称，弹窗中展示。 */
    label: string
    /** 指令用途说明。 */
    description: string
    /** 指令绑定的数据分组，决定注入哪组字段与 meta 上下文。 */
    groupKey: ProjectModGroupKey
    /** 生成记录时需注入的 SeidMeta 数据集名称列表；记录含 `seid` 字段的分组才需要。 */
    seidMetaDatasets?: string[]
}

/**
 * 内置指令列表：每个指令绑定一个数据分组，据此注入对应字段枚举与 SeidMeta 作为 AI 上下文。
 * seid 是 buff / 功法 / 神通 / 物品 / 悟道 记录中的一个字段，随完整记录一起生成。
 */
export const AI_COMMANDS: AiCommand[] = [
    {
        id: 'buff',
        keyword: '写buff',
        label: '写 buff',
        description: '生成一条 buff 记录（含 seid）',
        groupKey: 'buff',
        seidMetaDatasets: ['BuffSeidMeta'],
    },
    {
        id: 'skill',
        keyword: '写功法',
        label: '写功法',
        description: '生成一条功法记录（含 seid）',
        groupKey: 'skill',
        seidMetaDatasets: ['StaticSkillSeidMeta'],
    },
    {
        id: 'shenTong',
        keyword: '写神通',
        label: '写神通',
        description: '生成一条神通记录（含 seid）',
        groupKey: 'shenTong',
        seidMetaDatasets: ['SkillSeidMeta'],
    },
    {
        id: 'item',
        keyword: '写物品',
        label: '写物品',
        description: '生成一条物品记录（含 seid）',
        groupKey: 'item',
        seidMetaDatasets: ['ItemEquipSeidMeta', 'ItemUseSeidMeta'],
    },
    {
        id: 'wuDao',
        keyword: '写悟道',
        label: '写悟道',
        description: '生成一条悟道记录（含 seid）',
        groupKey: 'wuDao',
        seidMetaDatasets: ['StaticSkillSeidMeta'],
    },
    { id: 'npcType', keyword: '写NPC类型', label: '写 NPC 类型', description: '生成一条 NPC 类型记录', groupKey: 'npcType' },
]

/** 根据输入片段过滤指令；空片段返回全部。 */
export function filterAiCommands(commands: AiCommand[], query: string): AiCommand[] {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return commands
    return commands.filter(command =>
        [command.keyword, command.label, command.description, command.id].some(value => value.toLowerCase().includes(keyword))
    )
}

/** 序列化单个 Seid 定义（属性类型、描述与可选项）。 */
function formatSeidDefinition(definition: SeidMetaDefinition, datasets: JsonDataset[], records: SeidDrawerRecords): string {
    const lines: string[] = [`- Seid ${definition.id} ${definition.name}（参数对象键：${definition.idField}）`]
    if (definition.description) lines.push(`  - 说明：${definition.description}`)
    for (const property of definition.properties) {
        const options = getSeidPropertyOptions(property, datasets, records, [definition])
        const optionText = options.length > 0 ? `，可选值：${options.map(option => String(option.id)).join(' / ')}` : ''
        lines.push(`  - ${property.id}（${property.type}）：${property.description}${optionText}`)
    }
    return lines.join('\n')
}

/** 构建分组的字段枚举说明。 */
function buildFieldEnumSection(groupKey: ProjectModGroupKey, datasets: JsonDataset[]): string[] {
    const enumFields = GROUP_META_ENUM_FIELDS[groupKey]
    if (!enumFields) return []
    const lines: string[] = []
    for (const field of Object.keys(enumFields)) {
        const options = getGroupEnumOptions(groupKey, field, datasets)
        if (options.length === 0) continue
        lines.push(`- ${field}：可选取值`)
        for (const option of options) lines.push(`  - ${String(option.id)}：${option.label}`)
    }
    return lines
}

/**
 * 构建指令对应的 AI 上下文（system 提示片段）。
 * 根据指令绑定的分组注入字段枚举 meta，并注入该分组可用的 SeidMeta 定义（若记录含 seid 字段）。
 * @param command 当前选中的指令。
 * @param datasets 已预加载的 meta 数据集。
 * @param seidRecords 供 Seid 属性下拉解析的记录（可选）。
 */
export function buildCommandContext(command: AiCommand, datasets: JsonDataset[], seidRecords?: SeidDrawerRecords): string {
    const records = seidRecords ?? { buff: [], skill: [], staticSkill: [], item: [] }
    const sections: string[] = [`任务：${command.description}。请严格输出合法 JSON，不要输出多余的解释文字。`]

    sections.push(`## 目标分组：${command.groupKey}`)

    const fieldLines = buildFieldEnumSection(command.groupKey, datasets)
    if (fieldLines.length > 0) {
        sections.push('## 字段枚举说明')
        sections.push(...fieldLines)
    }

    if (command.seidMetaDatasets && command.seidMetaDatasets.length > 0) {
        const definitions = command.seidMetaDatasets.flatMap(name => getSeidDefinitions(datasets, name))
        if (definitions.length > 0) {
            sections.push('## 可用 Seid 定义')
            sections.push(
                '记录通过 `seid` 字段引用 Seid（值为 Seid 数字 id 数组），Seid 参数写入对应 Seid 数据文件，参数对象以 Seid 的 idField 作为键。'
            )
            sections.push(...definitions.map(definition => formatSeidDefinition(definition, datasets, records)))
        }
    }

    sections.push(
        [
            '## 输出格式要求',
            '请输出一个 JSON 对象，包含 `records` 数组与 `seidData` 对象：',
            '```',
            '{',
            '  "records": [',
            '    { "group": "skill", "key": "10001", "data": { "Skill_ID": 10001, "name": "火剑诀", "seid": [7] } },',
            '    { "group": "buff", "key": "20001", "data": { "buffid": 20001, "name": "灼烧", "seid": [3] } }',
            '  ],',
            '  "seidData": {',
            '    "staticSkill": { "7": { "10001": { "skillid": 10001, "value1": 10 } } },',
            '    "buff": { "3": { "20001": { "buffid": 20001, "value1": 5 } } }',
            '  }',
            '}',
            '```',
            '规则：',
            '1. `records` 第一项为主记录（目标分组），后续为它引用的依赖记录（如 buff、物品），group 取值仅限 buff/item/skill/shenTong/wuDao。',
            '2. 若主记录或依赖记录引用了其它 buff/物品，请递归地把这些被引用记录一并加入 `records`，并为它们各自的 seid 补写 `seidData`，直到不再产生新依赖。',
            '3. `key` 使用记录的主键字段值（buff→buffid，功法/神通→Skill_ID，物品→id）。',
            '4. `seidData` 的目录名（buff/skill/staticSkill/itemUse/itemEquip）与 Seid 所属分组对应，参数对象以该 Seid 的 idField 作为键。',
            '5. 除 JSON 外不要输出任何解释文字。',
        ].join('\n')
    )

    return sections.join('\n\n')
}
