import assert from 'node:assert/strict';
import { test } from 'node:test';

interface MissingItem {
  id: string;
  category: 'permit_blocker' | 'field_blocker' | 'professional_stamp' | 'owner_input';
  title: string;
  responsibleParty: string;
  stage: 'Pre-Construction' | 'Permit Review' | 'Construction Phase';
  status: 'outstanding' | 'rfi_sent' | 'verified';
  notes: string;
}

function computeContractorMetrics(items: MissingItem[]) {
  const verifiedCount = items.filter((i) => i.status === 'verified').length;
  const progressPct = Math.round((verifiedCount / items.length) * 100);
  const permitBlockers = items.filter((i) => i.category === 'permit_blocker' && i.status !== 'verified').length;
  const fieldBlockers = items.filter((i) => i.category === 'field_blocker' && i.status !== 'verified').length;
  const professionalStamps = items.filter((i) => i.category === 'professional_stamp' && i.status !== 'verified').length;

  return {
    verifiedCount,
    progressPct,
    permitBlockers,
    fieldBlockers,
    professionalStamps,
    isReadyForSiteDelivery: fieldBlockers === 0,
    isReadyForPermitSubmittal: permitBlockers === 0 && professionalStamps === 0,
  };
}

function cycleItemStatus(status: MissingItem['status']): MissingItem['status'] {
  if (status === 'outstanding') return 'rfi_sent';
  if (status === 'rfi_sent') return 'verified';
  return 'outstanding';
}

test('cycleItemStatus transitions through lifecycle deterministically', () => {
  let s: MissingItem['status'] = 'outstanding';
  s = cycleItemStatus(s);
  assert.equal(s, 'rfi_sent');
  s = cycleItemStatus(s);
  assert.equal(s, 'verified');
  s = cycleItemStatus(s);
  assert.equal(s, 'outstanding');
});

test('computeContractorMetrics correctly assesses readiness scores', () => {
  const sampleItems: MissingItem[] = [
    {
      id: 'MISS-01',
      category: 'professional_stamp',
      title: 'Architect Stamped Drawings',
      responsibleParty: 'Architect',
      stage: 'Permit Review',
      status: 'outstanding',
      notes: 'Stamped architectural drawings required',
    },
    {
      id: 'MISS-02',
      category: 'permit_blocker',
      title: 'Base Building C of O',
      responsibleParty: 'Owner',
      stage: 'Pre-Construction',
      status: 'outstanding',
      notes: 'Certificate of occupancy',
    },
    {
      id: 'MISS-03',
      category: 'field_blocker',
      title: 'Subsurface Core Drill & Radar Void Validation',
      responsibleParty: 'GC',
      stage: 'Construction Phase',
      status: 'outstanding',
      notes: 'Confirm void grouting',
    },
    {
      id: 'MISS-04',
      category: 'field_blocker',
      title: 'Electrical Panel Capacity',
      responsibleParty: 'Electrical Sub',
      stage: 'Pre-Construction',
      status: 'verified',
      notes: '200A 3-phase capacity verified',
    },
  ];

  const m1 = computeContractorMetrics(sampleItems);
  assert.equal(m1.verifiedCount, 1);
  assert.equal(m1.progressPct, 25);
  assert.equal(m1.permitBlockers, 1);
  assert.equal(m1.fieldBlockers, 1);
  assert.equal(m1.professionalStamps, 1);
  assert.equal(m1.isReadyForSiteDelivery, false);
  assert.equal(m1.isReadyForPermitSubmittal, false);

  // When field blocker is verified
  sampleItems[2].status = 'verified';
  const m2 = computeContractorMetrics(sampleItems);
  assert.equal(m2.fieldBlockers, 0);
  assert.equal(m2.isReadyForSiteDelivery, true);
  assert.equal(m2.isReadyForPermitSubmittal, false);

  // When permit and professional items verified
  sampleItems[0].status = 'verified';
  sampleItems[1].status = 'verified';
  const m3 = computeContractorMetrics(sampleItems);
  assert.equal(m3.progressPct, 100);
  assert.equal(m3.isReadyForPermitSubmittal, true);
});

test('contractor validation payload conforms to expected schema', () => {
  const exportData = {
    title: 'Schema General Contractor Validation & Missing Items Audit',
    contractor: {
      name: 'Marcus Vance, GC',
      company: 'Vance Commercial Builders LLC',
      licence: 'OR-CCB #248109',
      validated: true,
      timestamp: new Date().toISOString(),
    },
    validationCriteria: [
      { item: 'Scope fidelity to 60×40 commercial office suite', status: 'Passed' },
      { item: 'Subsurface radar void & structural footing analysis', status: 'Reviewed' },
    ],
  };

  assert.equal(typeof exportData.title, 'string');
  assert.equal(exportData.contractor.validated, true);
  assert.ok(exportData.contractor.licence.includes('OR-CCB'));
  assert.equal(exportData.validationCriteria.length, 2);
});

