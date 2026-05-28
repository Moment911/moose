import { describe, it, expect } from 'vitest'
import { parseMasterJson } from './topicCampaignGenerator'

// Regression suite for the multi-model "invalid JSON" bug. The old compare
// path stripped fences with anchored ^``` / ```$ regex, so any prose the model
// added before/after the JSON block defeated the strip and JSON.parse threw —
// reported to the operator as "invalid JSON". parseMasterJson must recover the
// object from every realistic wrapper a model emits.
describe('parseMasterJson — robust model JSON recovery', () => {
    const obj = { topic: 'Roof Repair', sections: [{ heading_template: 'About' }], faqs: [] }
    const json = JSON.stringify(obj)

    it('parses bare JSON (GPT-4o style)', () => {
        expect(parseMasterJson(json)).toEqual(obj)
    })

    it('parses a clean ```json fenced block', () => {
        expect(parseMasterJson('```json\n' + json + '\n```')).toEqual(obj)
    })

    it('parses a fenced block with prose BEFORE it (the Claude failure case)', () => {
        expect(parseMasterJson('Here is the master you asked for:\n\n```json\n' + json + '\n```')).toEqual(obj)
    })

    it('parses a fenced block with prose AFTER the closing fence', () => {
        expect(parseMasterJson('```json\n' + json + '\n```\n\nThis emphasizes E-E-A-T signals.')).toEqual(obj)
    })

    it('parses bare JSON with a trailing explanation and no fences', () => {
        expect(parseMasterJson(json + '\n\nLet me know if you want changes.')).toEqual(obj)
    })

    it('parses a plain ``` fence with no language tag', () => {
        expect(parseMasterJson('```\n' + json + '\n```')).toEqual(obj)
    })

    it('returns null for genuinely non-JSON text', () => {
        expect(parseMasterJson('I was unable to complete this request.')).toBeNull()
    })

    it('returns null for empty / whitespace input', () => {
        expect(parseMasterJson('')).toBeNull()
        expect(parseMasterJson('   \n  ')).toBeNull()
    })

    it('returns null for truncated (unterminated) JSON rather than throwing', () => {
        expect(parseMasterJson('```json\n{ "topic": "Roof", "sections": [')).toBeNull()
    })
})
