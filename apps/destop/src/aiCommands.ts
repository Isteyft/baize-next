import { translateField } from '@baize-next/i18n'
import type { JsonDataset, JsonValue, ProjectModGroupKey } from '@baize-next/types'

import { getDefaultRecordTemplate, getRecordIdField } from './utils/defaultRecordTemplates'
import { getGroupEnumOptions, GROUP_META_ENUM_FIELDS } from './utils/json'
import {
    getSeidDataKey,
    getSeidDefinitions,
    getSeidPropertyOptions,
    isSeidProjectGroup,
    type SeidDrawerRecords,
    type SeidMetaDefinition,
} from './utils/seid'

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
    /** 指令专属的自定义提示词（留空待扩展）；非空时会作为「自定义提示」段落注入到该指令的上下文最前面。 */
    customPrompt?: string
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
        customPrompt: '',
    },
    {
        id: 'skill',
        keyword: '写功法',
        label: '写功法',
        description: '生成一条功法记录（含 seid）',
        groupKey: 'skill',
        seidMetaDatasets: ['StaticSkillSeidMeta'],
        customPrompt:
            '功法是让玩家战斗时，获得指定的一个或者多个buff，通过buff来完成功法的具体效果，所以生成功法需要生成关于此功法的配套buff。',
    },
    {
        id: 'shenTong',
        keyword: '写神通',
        label: '写神通',
        description: '生成一条神通记录（含 seid）',
        groupKey: 'shenTong',
        seidMetaDatasets: ['SkillSeidMeta'],
        customPrompt: '',
    },
    {
        id: 'item',
        keyword: '写物品',
        label: '写物品',
        description: '生成一条物品记录（含 seid）',
        groupKey: 'item',
        seidMetaDatasets: ['ItemEquipSeidMeta', 'ItemUseSeidMeta'],
        customPrompt: '',
    },
    {
        id: 'wuDao',
        keyword: '写悟道',
        label: '写悟道',
        description: '生成一条悟道记录（含 seid）',
        groupKey: 'wuDao',
        seidMetaDatasets: ['StaticSkillSeidMeta'],
        customPrompt: '',
    },
    {
        id: 'npcType',
        keyword: '写NPC类型',
        label: '写 NPC 类型',
        description: '生成一条 NPC 类型记录',
        groupKey: 'npcType',
        customPrompt: '',
    },
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
    const lines: string[] = [
        `- Seid id=${definition.id}「${definition.name}」（write_seid 时 seidId 填 ${definition.id}，参数对象键：${definition.idField}）`,
    ]
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

/** 根据默认值推断字段的类型描述。 */
function describeFieldType(value: JsonValue): string {
    if (Array.isArray(value)) return '数组'
    if (typeof value === 'number') return '数字'
    if (typeof value === 'string') return '字符串'
    if (typeof value === 'boolean') return '布尔'
    return '对象'
}

/**
 * 构建分组的字段 schema 说明：字段名（类型）+ 中文名，供 AI 严格按照真实字段名生成数据。
 * 这是避免 AI 臆造字段名（如把 name 写成 skillName）的关键上下文。
 */
function buildFieldSchemaSection(groupKey: ProjectModGroupKey): string[] {
    const template = getDefaultRecordTemplate(groupKey)
    const idField = getRecordIdField(groupKey)
    if (!template) return []

    const lines: string[] = ['请严格使用以下字段名生成记录 data，不要臆造或改名：']
    // 主键字段优先展示。
    if (idField) {
        lines.push(`- ${idField}（数字）：记录主键，务必填写`)
    }
    for (const [field, defaultValue] of Object.entries(template)) {
        if (field === idField) continue
        const label = translateField(groupKey, field)
        const typeText = describeFieldType(defaultValue)
        const labelText = label !== field ? `，${label}` : ''
        lines.push(`- ${field}（${typeText}）${labelText}`)
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
    const sections: string[] = [`任务：${command.description}。请通过提供的工具（function calling）完成生成。`]

    if (command.customPrompt && command.customPrompt.trim()) {
        sections.push(`## 自定义提示\n${command.customPrompt.trim()}`)
    }

    sections.push(`## 目标分组：${command.groupKey}`)

    const schemaLines = buildFieldSchemaSection(command.groupKey)
    if (schemaLines.length > 0) {
        sections.push('## 字段 schema')
        sections.push(...schemaLines)
    }

    const fieldLines = buildFieldEnumSection(command.groupKey, datasets)
    if (fieldLines.length > 0) {
        sections.push('## 字段枚举说明')
        sections.push(...fieldLines)
    }

    if (command.seidMetaDatasets && command.seidMetaDatasets.length > 0) {
        const definitions = command.seidMetaDatasets.flatMap(name => getSeidDefinitions(datasets, name))
        if (definitions.length > 0) {
            sections.push('## 可用 Seid 定义')
            const seidDataKey = isSeidProjectGroup(command.groupKey) ? getSeidDataKey(command.groupKey, {}) : undefined
            const dataKeyHint = seidDataKey ? `本分组（${command.groupKey}）的 Seid 参数应写入 dataKey=\`${seidDataKey}\`。` : ''
            sections.push(
                `记录通过 \`seid\` 字段引用 Seid（值为 Seid 数字 id 数组），Seid 参数通过 \`write_seid\` 工具写入，seidId 必须用下方列出的 Seid 数字 id，参数对象以 Seid 的 idField 作为键。${dataKeyHint}`
            )
            sections.push(...definitions.map(definition => formatSeidDefinition(definition, datasets, records)))
        }
    }

    sections.push(
        [
            '## 生成方式（使用工具）',
            '请通过工具调用完成生成，不要直接输出 JSON 文本：',
            '1. 生成前，若内容涉及引用已有 buff/功法/神通/物品（例如功法需要引用某个 buff、效果需要叠加某个已有 buff 等），先调用 `search_record` 工具查询对应分组，确认是否已有可复用的记录。',
            '2. 查到已有记录时，直接引用其主键 id（如 buffid、id），不要重复新建；查不到时才新建。',
            '3. 用 `create_record` 工具写入主记录（目标分组），`key` 使用主键字段值（buff→buffid，功法/神通/物品/悟道→id），与 data 中的主键字段一致。',
            '4. 若主记录引用了其它 buff/物品（如功法引用了 buff、buff 又引用了物品），请递归地用 `create_record` 补写这些被引用的依赖记录。',
            '5. 对每条含 seid 的记录，用 `write_seid` 工具写入每个 Seid 的参数，`seidId` 用上文 Seid 定义里列出的数字 id，`dataKey` 按上文提示（buff→buff，神通→skill，功法/悟道→staticSkill，物品→itemUse/itemEquip），`targetKey` 与该记录的 key 一致。',
            '6. 若缺少生成所需的必要信息（尤其是 id 用多少），请优先调用 `ask_user` 工具向用户询问，而不是随意编造 id。',
            '7. 全部生成完成后，用一句简短的中文说明生成结果。',
        ].join('\n')
    )

    return sections.join('\n\n')
}
