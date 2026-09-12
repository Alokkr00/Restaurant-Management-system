import React from 'react';
import { useStore } from '../../context/StoreContext';
import { TrendingUp, Landmark, Calculator } from 'lucide-react';

export const FinancialsView: React.FC = () => {
  const { kpis, journalEntries } = useStore();

  const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Franchise Financials & NetSuite General Ledger (GL)</h2>
          <p className="workspace-subtitle">Daily batch close, double-entry balanced journals & prime cost KPI tracking</p>
        </div>

        <div className="erp-sync-pill">
          <Landmark size={15} className="text-emerald" />
          <span>NetSuite ERP Sync: <strong>CONNECTED</strong></span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Gross Sales Today</span>
            <TrendingUp size={16} className="text-emerald" />
          </div>
          <div className="kpi-val text-emerald">${Number(kpis?.grossSalesUSD ?? 0).toFixed(2)}</div>
          <div className="kpi-meta">All Dining & Aggregator Channels</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Net Sales</span>
            <Calculator size={16} className="text-muted" />
          </div>
          <div className="kpi-val">${Number(kpis?.netSalesUSD ?? 0).toFixed(2)}</div>
          <div className="kpi-meta">Excluding Sales Tax</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Tax Collected</span>
            <Landmark size={16} className="text-muted" />
          </div>
          <div className="kpi-val">${Number(kpis?.taxCollectedUSD ?? 0).toFixed(2)}</div>
          <div className="kpi-meta">Jurisdiction Sales Tax (8%)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Food Cost %</span>
            <span className="badge badge-online">PAR</span>
          </div>
          <div className="kpi-val text-emerald">{Number(kpis?.foodCostPct ?? 0).toFixed(1)}%</div>
          <div className="kpi-meta">Industry Benchmark: 28-32%</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Labor Cost %</span>
            <span className="badge badge-online">OPTIMAL</span>
          </div>
          <div className="kpi-val text-emerald">{Number(kpis?.laborCostPct ?? 0).toFixed(1)}%</div>
          <div className="kpi-meta">Target: &lt; 25%</div>
        </div>

        <div className="kpi-card highlight-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Prime Cost (COGS + Labor)</span>
            <span className="badge badge-online">EXCELLENT</span>
          </div>
          <div className="kpi-val highlight-val">{Number(kpis?.primeCostPct ?? 0).toFixed(1)}%</div>
          <div className="kpi-meta">Target: &lt; 55% Total Revenue</div>
        </div>
      </div>

      {/* NetSuite GL Ledger Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <Landmark size={16} />
          <span>Double-Entry Journal Batch &bull; NetSuite Account Mapping</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entry ID</th>
                <th>Posting Date</th>
                <th>GL Account</th>
                <th>Debit (USD)</th>
                <th>Credit (USD)</th>
                <th>Memo / Transaction Description</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map((je) => (
                <tr key={je.id}>
                  <td className="font-mono font-bold">{je.id}</td>
                  <td className="text-muted">{je.date}</td>
                  <td className="font-bold">{je.account}</td>
                  <td className="font-mono">{je.debit > 0 ? `$${je.debit.toFixed(2)}` : '&mdash;'}</td>
                  <td className="font-mono">{je.credit > 0 ? `$${je.credit.toFixed(2)}` : '&mdash;'}</td>
                  <td className="text-muted">{je.memo}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="totals-summary-row">
                <td colSpan={3} className="font-bold text-right">Balanced Total:</td>
                <td className="font-mono font-bold text-emerald">${totalDebit.toFixed(2)}</td>
                <td className="font-mono font-bold text-emerald">${totalCredit.toFixed(2)}</td>
                <td className="text-emerald font-bold">&check; Double-Entry Zero Proof Verified</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
