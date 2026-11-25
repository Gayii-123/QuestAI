/**
 * QuestAI — SSRA Hot Works Pre-Work Verification Checks
 *
 * 4 authoritative checks verified from the original Quest safety audit:
 * 1. HW-1: Fire extinguishers present, inspected, and readily accessible
 * 2. HW-2: 10m clear radius of all combustible materials or suitable fire-retardant shielding
 * 3. HW-3: Dedicated fire watch operative assigned during works and minimum 60 mins post-completion
 * 4. HW-4: Equipment leak integrity verified (hoses, regulators, flashback arrestors in good condition)
 */
export const SSRA_HOT_WORKS_CHECKS_CONFIG = [
    {
        id: 'HW-1',
        title: 'Fire Extinguishers Present & Checked',
        description: 'Suitable and serviced fire extinguishers (e.g. Dry Powder / CO2 / Foam) are immediately adjacent to the work area, inspected, and fully charged.',
    },
    {
        id: 'HW-2',
        title: '10m Combustible Clearance / Shielding',
        description: 'All flammable or combustible materials (rubbish, vegetation, timber, gas bottles, fuel) are cleared to a minimum of 10m radius or protected with fire-resistant blankets/screens.',
    },
    {
        id: 'HW-3',
        title: 'Dedicated Fire Watch Assigned',
        description: 'A trained operative has been designated to maintain a continuous fire watch throughout the hot works operation and for at least 60 minutes after flame/heating cessation.',
    },
    {
        id: 'HW-4',
        title: 'Equipment Leak Integrity & Flashback Arrestors',
        description: 'Gas cylinders, hoses, clamps, torches, regulators, and flashback arrestors have been leak-tested (soapy water / detector) and confirmed in sound working condition.',
    },
];
export function createDefaultHotWorksData(triggerQuestionId) {
    return {
        applicable: false,
        triggerQuestionId,
        checks: SSRA_HOT_WORKS_CHECKS_CONFIG.map((c) => ({
            ...c,
            status: 'N/A',
            notes: '',
        })),
    };
}
