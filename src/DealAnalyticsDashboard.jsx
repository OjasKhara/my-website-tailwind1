
// NOTE: This is a simplified implementation of the Deal Tease Dashboard with:
// 1. Saved Views using localStorage
// 2. URL sync for filter state
// 3. PNG and CSV export features
// Paste this into src/DealAnalyticsDashboard.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

const DealAnalyticsDashboard = () => {
  const [deals, setDeals] = useState([]);
  const [filters, setFilters] = useState({
    verticals: [],
    ebitdaRange: [0, 40000000],
    includeSmartshareEnabled: null,
  });
  const [filterOptions, setFilterOptions] = useState({ verticals: [] });
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [chartViewMode, setChartViewMode] = useState({ vertical: 'count', activity: 'count' });
  const [savedViews, setSavedViews] = useState(() => JSON.parse(localStorage.getItem('savedViews') || '[]'));
  const fileInputRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const vertical = urlParams.get('vertical');
    const ebitdaMin = urlParams.get('minEBITDA');
    const smartshare = urlParams.get('smartshare');

    if (vertical || ebitdaMin || smartshare) {
      setFilters(prev => ({
        ...prev,
        verticals: vertical ? [vertical] : [],
        ebitdaRange: ebitdaMin ? [parseInt(ebitdaMin), 40000000] : prev.ebitdaRange,
        includeSmartshareEnabled: smartshare === 'true' ? true : smartshare === 'false' ? false : null,
      }));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.verticals.length) params.set('vertical', filters.verticals[0]);
    if (filters.ebitdaRange[0] > 0) params.set('minEBITDA', filters.ebitdaRange[0]);
    if (filters.includeSmartshareEnabled !== null) params.set('smartshare', filters.includeSmartshareEnabled);
    window.history.replaceState(null, '', '?' + params.toString());
  }, [filters]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = Papa.parse(e.target.result, { header: true, dynamicTyping: true });
      if (result.errors.length) return;
      setDeals(result.data);
      setFilterOptions({
        verticals: [...new Set(result.data.map(d => d["Primary Supply Vertical"]))].filter(Boolean),
      });
    };
    reader.readAsText(file);
  };

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (filters.verticals.length && !filters.verticals.includes(d["Primary Supply Vertical"])) return false;
      if (d.EBITDA < filters.ebitdaRange[0] || d.EBITDA > filters.ebitdaRange[1]) return false;
      if (filters.includeSmartshareEnabled !== null) {
        const val = d["SmartShare Enabled?"];
        const enabled = val === 1 || val === "1" || val === true;
        if (filters.includeSmartshareEnabled !== enabled) return false;
      }
      return true;
    });
  }, [deals, filters]);

  const verticalChartData = useMemo(() => {
    const counts = {};
    filteredDeals.forEach(d => {
      const v = d["Primary Supply Vertical"];
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: (value / filteredDeals.length) * 100
    }));
  }, [filteredDeals]);

  const downloadFilteredDealsAsCSV = () => {
    if (!filteredDeals.length) return;
    const fields = Object.keys(filteredDeals[0]);
    const csvContent = [fields.join(',')]
      .concat(filteredDeals.map(row => fields.map(f => JSON.stringify(row[f] ?? '')).join(',')))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'filtered_deals.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartAsImage = (chartId, fileName) => {
    const chartEl = document.getElementById(chartId);
    if (!chartEl) return;
    import('html2canvas').then(html2canvas => {
      html2canvas.default(chartEl).then(canvas => {
        const link = document.createElement('a');
        link.download = fileName + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  };

  const saveCurrentView = () => {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    const updatedViews = [...savedViews, { name, filters }];
    setSavedViews(updatedViews);
    localStorage.setItem('savedViews', JSON.stringify(updatedViews));
  };

  const applySavedView = (view) => {
    setFilters(view.filters);
  };

  const summaryStats = useMemo(() => {
    if (!filteredDeals.length) return null;
    return {
      totalDeals: filteredDeals.length,
      avgEBITDA: filteredDeals.reduce((sum, d) => sum + (d.EBITDA || 0), 0) / filteredDeals.length,
    };
  }, [filteredDeals]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Deal Tease Dashboard</h1>
        <div className="flex space-x-2">
          <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="hidden" id="csv-upload" />
          <label htmlFor="csv-upload" className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">Upload CSV</label>
          <button onClick={() => setFilters({ verticals: [], ebitdaRange: [0, 40000000], includeSmartshareEnabled: null })} className="px-4 py-2 bg-gray-200 rounded">Reset Filters</button>
        </div>
      </header>

      <div className="flex space-x-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
          <select
            value={filters.verticals[0] || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, verticals: e.target.value ? [e.target.value] : [] }))}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            {filterOptions.verticals.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min EBITDA</label>
          <input
            type="number"
            value={filters.ebitdaRange[0]}
            onChange={(e) => setFilters(prev => ({ ...prev, ebitdaRange: [parseInt(e.target.value), prev.ebitdaRange[1]] }))}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SmartShare</label>
          <select
            value={filters.includeSmartshareEnabled === null ? '' : filters.includeSmartshareEnabled ? 'true' : 'false'}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              includeSmartshareEnabled: e.target.value === '' ? null : e.target.value === 'true'
            }))}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="true">Enabled Only</option>
            <option value="false">Disabled Only</option>
          </select>
        </div>
      </div>

      <div className="flex space-x-4">
        <button onClick={saveCurrentView} className="bg-green-600 text-white px-4 py-2 rounded">Save Current View</button>
        {savedViews.length > 0 && (
          <select onChange={(e) => applySavedView(savedViews[e.target.selectedIndex - 1])} className="border rounded px-2 py-1">
            <option>Select Saved View</option>
            {savedViews.map((view, idx) => <option key={idx}>{view.name}</option>)}
          </select>
        )}
      </div>

      {summaryStats && (
        <div className="bg-white p-4 rounded shadow">
          <div className="text-lg font-semibold mb-2">Summary</div>
          <div>Total Deals: {summaryStats.totalDeals}</div>
          <div>Avg EBITDA: ${summaryStats.avgEBITDA.toFixed(1)}</div>
        </div>
      )}

      <div className="bg-white p-4 rounded shadow">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Deals by Vertical</h2>
          <button onClick={() => exportChartAsImage('vertical-chart', 'Deals by Vertical')} className="text-sm bg-gray-100 border px-2 py-1 rounded">Download PNG</button>
        </div>
        <div id="vertical-chart">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={verticalChartData} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip />
              <Bar dataKey={chartViewMode.vertical === 'count' ? 'value' : 'percentage'}>
                {verticalChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#8884d8" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={downloadFilteredDealsAsCSV} className="bg-green-600 text-white px-4 py-2 rounded mt-4">
          Download Filtered Deals (CSV)
        </button>
      </div>
    </div>
  );
};

export default DealAnalyticsDashboard;
