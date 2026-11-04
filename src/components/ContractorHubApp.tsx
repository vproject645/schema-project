'use client';
import { useState } from 'react';
import { SchemaMark } from './SchemaMark';
import {
  AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, ClipboardCheck,
  Download, FileCheck, FileText, Filter, HardHat, HelpCircle, Layers,
  Plus, Printer, Search, ShieldAlert, ShieldCheck, Sparkles, UserCheck, Wrench
} from 'lucide-react';

interface MissingItem {
  id: string;
  category: 'permit_blocker' | 'field_blocker' | 'professional_stamp' | 'owner_input';
  title: string;
  responsibleParty: string;
  stage: 'Pre-Construction' | 'Permit Review' | 'Construction Phase';
  status: 'outstanding' | 'rfi_sent' | 'verified';
  notes: string;
}

export function ContractorHubApp() {
  const [contractorName, setContractorName] = useState('Marcus Vance, GC');
  const [companyName, setCompanyName] = useState('Vance Commercial Builders LLC');
  const [licenceNumber, setLicenceNumber] = useState('OR-CCB #248109');
  const [contractorValidated, setContractorValidated] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'permit_blocker' | 'field_blocker' | 'professional_stamp'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Missing Items consolidated from project brief and permit package
  const [items, setItems] = useState<MissingItem[]>([
    {
      id: 'MISS-01',
      category: 'professional_stamp',
      title: 'Architect of Record Stamped Drawings (Plans, Sections, Elevations)',
      responsibleParty: 'Licensed Architect (Oregon registered)',
      stage: 'Permit Review',
      status: 'outstanding',
      notes: 'The 2D/3D concept is an approved planning model; Oregon requires stamped architectural sheets for commercial tenant improvement.',
    },
    {
      id: 'MISS-02',
      category: 'permit_blocker',
      title: 'Approved Prior Permit History for Suite (Base Building Certificate of Occupancy)',
      responsibleParty: 'Building Owner / Property Manager',
      stage: 'Pre-Construction',
      status: 'outstanding',
      notes: 'Required by Portland Bureau of Development Services (BDS) to establish non-conforming status and prior use classification.',
    },
    {
      id: 'MISS-03',
      category: 'field_blocker',
      title: 'Subsurface Core Drill & GPR Void Validation (SW Column A4)',
      responsibleParty: 'General Contractor / Special Inspector',
      stage: 'Construction Phase',
      status: 'outstanding',
      notes: 'Radar scan identified 2.8m cavity under South-West footing. Grouting required before heavy structural partitions erected.',
    },
    {
      id: 'MISS-04',
      category: 'professional_stamp',
      title: 'Structural Engineering Review & Ceiling Framing Attachment Calculations',
      responsibleParty: 'Licensed Structural Engineer (PE / SE)',
      stage: 'Permit Review',
      status: 'rfi_sent',
      notes: '10 ft acoustic ceiling suspension and meeting room demising partition acoustic anchor detail.',
    },
    {
      id: 'MISS-05',
      category: 'permit_blocker',
      title: 'Commercial Mechanical / HVAC Distribution & Ventilation Calculations',
      responsibleParty: 'Mechanical Engineer (PE)',
      stage: 'Permit Review',
      status: 'outstanding',
      notes: 'Fresh air ventilation cfm delivery to meeting room and private quiet offices.',
    },
    {
      id: 'MISS-06',
      category: 'field_blocker',
      title: 'Existing Electrical Panel Capacity & Tenant Sub-Panel Clearances',
      responsibleParty: 'Electrical Subcontractor (C-10)',
      stage: 'Pre-Construction',
      status: 'verified',
      notes: 'Verified 200A 120/208V 3-phase feeder in suite utility closet; adequate for 9 workstations and meeting room tech.',
    },
    {
      id: 'MISS-07',
      category: 'owner_input',
      title: 'Property Owner Letter of Authorization for Tenant Alterations',
      responsibleParty: 'Property Owner',
      stage: 'Pre-Construction',
      status: 'rfi_sent',
      notes: 'Form 114 required by city building intake department.',
    },
    {
      id: 'MISS-08',
      category: 'field_blocker',
      title: 'ADA Accessible Route & Restroom Clearance Field Verification',
      responsibleParty: 'General Contractor Site Superintendent',
      stage: 'Construction Phase',
      status: 'outstanding',
      notes: 'Verify 36″ clear corridor width and 60″ turning diameter in shared circulation zone.',
    },
  ]);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MissingItem['category']>('field_blocker');
  const [newItemParty, setNewItemParty] = useState('');

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const nextStatus = it.status === 'outstanding' ? 'rfi_sent' : it.status === 'rfi_sent' ? 'verified' : 'outstanding';
        return { ...it, status: nextStatus };
      })
    );
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    const newItem: MissingItem = {
      id: `MISS-0${items.length + 1}`,
      category: newItemCategory,
      title: newItemTitle.trim(),
      responsibleParty: newItemParty.trim() || 'General Contractor',
      stage: 'Construction Phase',
      status: 'outstanding',
      notes: 'Added from General Contractor field walk-through.',
    };
    setItems([newItem, ...items]);
    setNewItemTitle('');
    setNewItemParty('');
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter !== 'all' && item.category !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q) || item.responsibleParty.toLowerCase().includes(q);
    }
    return true;
  });

  const verifiedCount = items.filter((i) => i.status === 'verified').length;
  const progressPct = Math.round((verifiedCount / items.length) * 100);

  const exportContractorPackage = () => {
    const report = {
      title: 'Schema General Contractor Validation & Missing Items Audit',
      contractor: {
        name: contractorName,
        company: companyName,
        licence: licenceNumber,
        validated: contractorValidated,
        timestamp: new Date().toISOString(),
      },
      summary: {
        totalItems: items.length,
        verifiedItems: verifiedCount,
        readinessScore: `${progressPct}%`,
      },
      checklist: items,
      validationCriteria: [
        { item: 'Scope fidelity to 60×40 commercial office suite', status: 'Passed' },
        { item: 'Subsurface radar void & structural footing analysis', status: 'Reviewed (Action required on SW Column)' },
        { item: 'Code path alignment (Portland Commercial BDS)', status: 'Verified' },
        { item: 'Subcontractor trade handoff package readiness', status: 'Ready for bid release' },
      ],
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-contractor-validation-brief-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f4', color: '#14212b', fontFamily: '"IBM Plex Sans", Inter, sans-serif' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #d5dad9', background: '#fff', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#14212b', fontWeight: 600, fontSize: 18 }}>
            <SchemaMark size={24} />
            <span>Schema</span>
          </a>
          <span style={{ height: 18, width: 1, background: '#d5dad9' }} />
          <span style={{ fontSize: 13, color: '#5b6872', fontWeight: 500 }}>
            General Contractor Validation & Missing Items Hub
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
          <a href="/app" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Workspace</a>
          <a href="/radar" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Subsurface Radar</a>
          <a href="/studio" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Studio 3D</a>
          <a href="/site" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Site View</a>
          <a href="/simulate" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Climate</a>
          <a
            href="/app"
            style={{
              padding: '6px 14px',
              background: '#14212b',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Open Project
          </a>
        </nav>
      </header>

      {/* Hero Banner */}
      <div style={{ background: '#14212b', color: '#fff', padding: '24px 24px 28px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#8a5a1f', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            <HardHat size={12} /> General Contractor Validation Suite · Field & Permit Coordination
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Missing Items & Contractor Validation Hub
          </h1>
          <p style={{ margin: 0, maxWidth: 840, fontSize: 15, color: '#a0afbb', lineHeight: 1.5 }}>
            Consolidates missing facts from briefs, unverified drawing pages, structural radar alerts, and municipal codes into an actionable field punch list. Built for direct evaluation with general contractors to guarantee constructability, resolve scope gaps, and prevent costly jobsite delays.
          </p>
        </div>
      </div>

      <main style={{ maxWidth: 1180, margin: '20px auto', padding: '0 16px' }}>
        {/* Contractor Meeting Sign-off & Status Banner */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: contractorValidated ? '#e8f5e9' : '#fff3e0', color: contractorValidated ? '#2e7d32' : '#ef6c00', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {contractorValidated ? 'Contractor Validated' : 'Validation Meeting Pending'}
                </span>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>General Contractor Field Sign-Off</h2>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5b6872' }}>
                Use this during your meeting with the general contractor to validate project assumptions, review radar findings, and record practitioner confirmation.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setContractorValidated(!contractorValidated)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 0,
                  background: contractorValidated ? '#2e7d32' : '#14212b',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={15} />
                {contractorValidated ? 'Sign-Off Recorded' : 'Mark Contractor Validated'}
              </button>

              <button
                onClick={exportContractorPackage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #c9cfc4',
                  background: '#fff',
                  color: '#14212b',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Export Brief
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16, paddingTop: 16, borderTop: '1px solid #eceff0' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5b6872', display: 'block', marginBottom: 4 }}>
                Practitioner / Contractor Name
              </label>
              <input
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5b6872', display: 'block', marginBottom: 4 }}>
                Construction Firm
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5b6872', display: 'block', marginBottom: 4 }}>
                State Licence / CCB #
              </label>
              <input
                value={licenceNumber}
                onChange={(e) => setLicenceNumber(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 14 }}
              />
            </div>
          </div>
        </div>

        {/* Readiness Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Items Resolved
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#14212b' }}>
                {verifiedCount}
              </span>
              <span style={{ fontSize: 14, color: '#5b6872' }}>/ {items.length}</span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#eceff0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#2e7d32', transition: 'width .3s' }} />
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Permit Blockers
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#ef6c00', marginTop: 4 }}>
              {items.filter((i) => i.category === 'permit_blocker' && i.status !== 'verified').length}
            </div>
            <div style={{ fontSize: 12, color: '#5b6872', marginTop: 4 }}>
              Requires city submittal evidence
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Field Blockers
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#c62828', marginTop: 4 }}>
              {items.filter((i) => i.category === 'field_blocker' && i.status !== 'verified').length}
            </div>
            <div style={{ fontSize: 12, color: '#5b6872', marginTop: 4 }}>
              On-site conditions & radar void
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Professional Stamps
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1d4f7c', marginTop: 4 }}>
              {items.filter((i) => i.category === 'professional_stamp' && i.status !== 'verified').length}
            </div>
            <div style={{ fontSize: 12, color: '#5b6872', marginTop: 4 }}>
              Architect & structural PE
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Open Items' },
              { id: 'field_blocker', label: 'Field Conditions' },
              { id: 'permit_blocker', label: 'Permit Blockers' },
              { id: 'professional_stamp', label: 'Professional Stamps' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${activeFilter === f.id ? '#14212b' : '#c9cfc4'}`,
                  background: activeFilter === f.id ? '#14212b' : '#fff',
                  color: activeFilter === f.id ? '#fff' : '#14212b',
                  fontSize: 13,
                  fontWeight: activeFilter === f.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#8a98a2' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search missing items…"
              style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 13 }}
            />
          </div>
        </div>

        {/* Missing Items List */}
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {filteredItems.map((item) => {
            const isVerified = item.status === 'verified';
            const isRfi = item.status === 'rfi_sent';

            return (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  border: `1px solid ${isVerified ? '#a5d6a7' : '#d5dad9'}`,
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  transition: 'background .15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          item.category === 'field_blocker' ? '#ffebee' : item.category === 'permit_blocker' ? '#fff3e0' : '#e3f2fd',
                        color:
                          item.category === 'field_blocker' ? '#c62828' : item.category === 'permit_blocker' ? '#ef6c00' : '#1565c0',
                      }}
                    >
                      {item.category.replace('_', ' ')}
                    </span>
                    <strong style={{ fontSize: 15, color: isVerified ? '#5b6872' : '#14212b', textDecoration: isVerified ? 'line-through' : 'none' }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: 12, color: '#8a98a2' }}>({item.id})</span>
                  </div>

                  <p style={{ margin: '6px 0 8px', fontSize: 13.5, color: '#334155' }}>
                    {item.notes}
                  </p>

                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#5b6872', flexWrap: 'wrap' }}>
                    <span>Responsible: <b>{item.responsibleParty}</b></span>
                    <span>Stage: <b>{item.stage}</b></span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => toggleStatus(item.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: `1px solid ${isVerified ? '#2e7d32' : isRfi ? '#ef6c00' : '#c9cfc4'}`,
                      background: isVerified ? '#e8f5e9' : isRfi ? '#fff3e0' : '#fff',
                      color: isVerified ? '#2e7d32' : isRfi ? '#ef6c00' : '#14212b',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isVerified ? <Check size={13} /> : <AlertCircle size={13} />}
                    {isVerified ? 'Verified & Complete' : isRfi ? 'RFI Dispatched' : 'Mark In Progress'}
                  </button>
                  <span style={{ fontSize: 11, color: '#8a98a2' }}>Click to cycle status</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Field Item Box */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Plus size={18} color="#1d4f7c" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add Field Observation / Contractor Item</h3>
          </div>
          <form onSubmit={addItem} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 200px auto', gap: 10, marginTop: 10 }}>
            <input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="e.g. Confirm fire damper location at demising wall penetration"
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 13 }}
            />
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value as any)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 13 }}
            >
              <option value="field_blocker">Field Condition</option>
              <option value="permit_blocker">Permit Blocker</option>
              <option value="professional_stamp">Professional Stamp</option>
              <option value="owner_input">Owner Input</option>
            </select>
            <input
              value={newItemParty}
              onChange={(e) => setNewItemParty(e.target.value)}
              placeholder="Responsible Party (e.g. Drywall Sub)"
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #c9cfc4', fontSize: 13 }}
            />
            <button
              type="submit"
              disabled={!newItemTitle.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 0,
                background: '#14212b',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add Item
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

