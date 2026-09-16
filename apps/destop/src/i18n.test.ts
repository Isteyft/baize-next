import { translateField } from '@baize-next/i18n'
import { describe, expect, it } from 'vitest'

describe('i18n field labels', () => {
    it('prioritizes zh-CN locale data', () => {
        expect(translateField('item', 'CanSale')).toBe('是否可出售')
        expect(translateField('skill', 'Skill_ID')).toBe('功法唯一id')
    })

    it('maps app group keys to locale dataset names', () => {
        expect(translateField('shenTong', 'Skill_Type')).toBe('技能释放优先级')
        expect(translateField('config', 'Name')).toBe('mod名称')
    })

    it('supports English and raw field fallback', () => {
        expect(translateField('item', 'CanSale', 'en')).toBe('CanSale')
        expect(translateField('item', 'unknown', 'en')).toBe('unknown')
    })
})
