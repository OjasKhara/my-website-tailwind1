import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Papa from 'papaparse';

// Main Dashboard Component
const DealAnalyticsDashboard = () => {
  // State variables
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [chartViewMode, setChartViewMode] = useState({
    vertical: 'count', // 'count' or 'percentage'
    activity: 'count'  // 'count' or 'percentage'
  });
  
  // Initialize state variables with safe defaults
  const [filters, setFilters] = useState({
    revenueRange: [0, 0],
    ebitdaRange: [2000000, 0],
    verticals: [],
    activities: [],
    regions: [],
    states: [],
    dateRange: [
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
    ],
    pursuitsRange: [0, 0],
    includeBrokers: false,
    includeSmartshareEnabled: true,
    includeInboundInquiryEnabled: true,
    dealIntentStatuses: ['active'],
    dealIntentTypes: ['sell']
  });
  
  const [filterOptions, setFilterOptions] = useState({
    verticals: [],
    activities: [],
    regions: [],
    states: [],
    dealIntentStatuses: [],
    dealIntentTypes: []
  });

  const [columns, setColumns] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const defaultAppliedRef = useRef(false);
  const refreshIntervalRef = useRef(null);

  const fetchData = async () => {
    const SHEET_URLS = [
      // Direct URLs (will likely fail due to CORS)
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQW313wJJkfO9xzyNi41jXBmn728Cj5_3Vs2VtIvQe7vA6B1E4j0TfI99TC2FFbX4RXiGukPfkxOgJ/pub?gid=0&single=true&output=csv',
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQW313wJJkfO9xzyNi41jXBmn728Cj5_3Vs2VtIvQe7vA6B1E4j0TfI99TC2FFbX4RXiGukPfkxOgJ/export?format=csv&gid=0',
      // CORS proxies as fallbacks
      'https://api.allorigins.win/get?url=' + encodeURIComponent('https://docs.google.com/spreadsheets/d/e/2PACX-1vTQW313wJJkfO9xzyNi41jXBmn728Cj5_3Vs2VtIvQe7vA6B1E4j0TfI99TC2FFbX4RXiGukPfkxOgJ/pub?gid=0&single=true&output=csv'),
      'https://corsproxy.io/?' + encodeURIComponent('https://docs.google.com/spreadsheets/d/e/2PACX-1vTQW313wJJkfO9xzyNi41jXBmn728Cj5_3Vs2VtIvQe7vA6B1E4j0TfI99TC2FFbX4RXiGukPfkxOgJ/pub?gid=0&single=true&output=csv'),
      'https://cors-anywhere.herokuapp.com/https://docs.google.com/spreadsheets/d/e/2PACX-1vTQW313wJJkfO9xzyNi41jXBmn728Cj5_3Vs2VtIvQe7vA6B1E4j0TfI99TC2FFbX4RXiGukPfkxOgJ/pub?gid=0&single=true&output=csv'
    ];

    setLoading(true);
    setError('');
    let lastError = null;
    
    for (let i = 0; i < SHEET_URLS.length; i++) {
      const url = SHEET_URLS[i];
      const isCorsProxy = url.includes('allorigins.win') || url.includes('corsproxy.io') || url.includes('cors-anywhere');
      
      try {
        console.log(`Attempting to fetch from: ${isCorsProxy ? 'CORS Proxy' : 'Direct'} - ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/csv,application/json,text/plain,*/*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let csvText;
        
        if (url.includes('allorigins.win')) {
          // allorigins.win returns JSON with contents field
          const jsonData = await response.json();
          csvText = jsonData.contents;
        } else if (url.includes('corsproxy.io')) {
          // corsproxy.io returns direct content
          csvText = await response.text();
        } else {
          // Direct or cors-anywhere returns direct content
          csvText = await response.text();
        }

        if (!csvText || csvText.trim().length === 0) {
          throw new Error('Empty response received');
        }

        console.log(`Successfully fetched data (${csvText.length} characters)`);

        // Parse the CSV
        const result = Papa.parse(csvText, { 
          header: true, 
          dynamicTyping: true, 
          skipEmptyLines: true 
        });
        
        if (result.errors && result.errors.length > 0) {
          console.warn('CSV parsing warnings:', result.errors);
        }

        const dealsData = result.data || [];
        const headers = result.meta.fields || [];

        if (dealsData.length === 0) {
          throw new Error('No data found in CSV');
        }

        const options = {
          verticals: [...new Set(dealsData.map(d => d['Primary Supply Vertical']))].filter(Boolean),
          activities: [...new Set(dealsData.map(d => d['Primary Supply Activity']))].filter(Boolean),
          regions: [...new Set(dealsData.map(d => d.Region))].filter(Boolean),
          states: [...new Set(dealsData.map(d => d['State/Province']))].filter(Boolean),
          dealIntentStatuses: [...new Set(dealsData.map(d => d['Deal Intent Status'] || d['Deal Intent']))].filter(Boolean),
          dealIntentTypes: [...new Set(dealsData.map(d => d['Deal Intent']))].filter(Boolean)
        };

        const maxPursuits = Math.max(...dealsData.map(d => d['Total Pursuits'] || 0));
        const maxRevenue = Math.max(...dealsData.map(d => d.Revenue || 0));
        const maxEbitda = Math.max(...dealsData.map(d => d.EBITDA || 0));

        setDeals(dealsData);
        setColumns(headers);
        setFilterOptions(options);
        setLastRefresh(new Date());

        if (!defaultAppliedRef.current) {
          setFilters(prev => ({
            ...prev,
            revenueRange: [0, maxRevenue],
            ebitdaRange: [2000000, maxEbitda],
            pursuitsRange: [0, maxPursuits]
          }));
          defaultAppliedRef.current = true;
        } else {
          setFilters(prev => ({
            ...prev,
            revenueRange: [prev.revenueRange[0], maxRevenue],
            ebitdaRange: [prev.ebitdaRange[0], maxEbitda],
            pursuitsRange: [prev.pursuitsRange[0], maxPursuits]
          }));
        }

        if (headers.includes('EBITDA Margin')) {
          const numeric = dealsData.some(d => !isNaN(parseFloat(d['EBITDA Margin'])));
          if (numeric) {
            setSortConfig({ key: 'EBITDA Margin', direction: 'desc' });
          }
        }

        setLoading(false);
        return; // Success! Exit the function

      } catch (err) {
        console.error(`Failed with ${isCorsProxy ? 'CORS Proxy' : 'Direct'} URL:`, err.message);
        lastError = err;
        
        // If this is the last URL, we'll set the error
        if (i === SHEET_URLS.length - 1) {
          setError(`All fetch attempts failed. Last error: ${err.message}`);
          setLoading(false);
          return;
        }
        
        // Otherwise, continue to next URL
        continue;
      }
    }
  };

  // Initial data load and setup auto-refresh
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 2 hours (2 * 60 * 60 * 1000 ms)
    refreshIntervalRef.current = setInterval(() => {
      console.log('Auto-refreshing sheet data...');
      fetchData();
    }, 2 * 60 * 60 * 1000);
    
    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);
  
  // Apply filters to deals
  const filteredDeals = useMemo(() => {
    if (!deals || !deals.length) return [];
    if (!filters) return deals;
    
    return deals.filter(deal => {
      if (!deal) return false;
      
      // Revenue filter
      if (filters.revenueRange && 
          (deal.Revenue < filters.revenueRange[0] || deal.Revenue > filters.revenueRange[1])) {
        return false;
      }
      
      // EBITDA filter
      if (filters.ebitdaRange && 
          (deal.EBITDA < filters.ebitdaRange[0] || deal.EBITDA > filters.ebitdaRange[1])) {
        return false;
      }
      
      // Pursuits filter
      if (filters.pursuitsRange && 
          (deal["Total Pursuits"] < filters.pursuitsRange[0] || 
           deal["Total Pursuits"] > filters.pursuitsRange[1])) {
        return false;
      }
      
      // Vertical filter
      if (filters.verticals && filters.verticals.length > 0 && 
          !filters.verticals.includes(deal["Primary Supply Vertical"])) {
        return false;
      }
      
      // Activity filter
      if (filters.activities && filters.activities.length > 0 && 
          !filters.activities.includes(deal["Primary Supply Activity"])) {
        return false;
      }
      
      // Region filter
      if (filters.regions && filters.regions.length > 0 && 
          !filters.regions.includes(deal.Region)) {
        return false;
      }
      
      // State filter
      if (filters.states && filters.states.length > 0 && 
          !filters.states.includes(deal["State/Province"])) {
        return false;
      }
      
      // Account Owner (Broker) filter
      if (
        filters.includeBrokers === false &&
        deal['Account Owner'] &&
        deal['Account Owner'].toString().toLowerCase() === 'broker'
      ) {
        return false;
      }

      // Smartshare / Inbound Inquiry filters
      const smartshareValue = deal['SmartShare Enabled?'];
      const inboundValue = deal['Inbound Inquiry Enabled?'];
      const smartshareEnabled =
        smartshareValue === 1 ||
        smartshareValue === '1' ||
        smartshareValue === true ||
        (typeof smartshareValue === 'string' && smartshareValue.toUpperCase() === 'TRUE');
      const inboundEnabled =
        inboundValue === 1 ||
        inboundValue === '1' ||
        inboundValue === true ||
        (typeof inboundValue === 'string' && inboundValue.toUpperCase() === 'TRUE');

      if (filters.includeSmartshareEnabled === true && filters.includeInboundInquiryEnabled === true) {
        if (!smartshareEnabled && !inboundEnabled) {
          return false;
        }
      } else {
        if (
          filters.includeSmartshareEnabled !== null &&
          smartshareEnabled !== filters.includeSmartshareEnabled
        ) {
          return false;
        }
        if (
          filters.includeInboundInquiryEnabled !== null &&
          inboundEnabled !== filters.includeInboundInquiryEnabled
        ) {
          return false;
        }
      }

      // Deal Intent Status filter
      if (filters.dealIntentStatuses && filters.dealIntentStatuses.length > 0) {
        const statusField = deal['Deal Intent Status'] || deal['Deal Intent'] || '';
        if (
          !filters.dealIntentStatuses.some(
            (s) => statusField.toString().toLowerCase() === s.toLowerCase()
          )
        ) {
          return false;
        }
      }

      // Deal Intent Type filter
      if (filters.dealIntentTypes && filters.dealIntentTypes.length > 0) {
        const typeField = deal['Deal Intent'] || '';
        if (
          !filters.dealIntentTypes.some((t) =>
            typeField.toString().toLowerCase().includes(t.toLowerCase())
          )
        ) {
          return false;
        }
      }

      // Date filter - convert string date to Date object
      const dateStr = deal['Market Date'] || deal['Market Date (Date)'];
      if (dateStr && filters.dateRange) {
        try {
          const dateParts = dateStr.split('/');
          if (dateParts && dateParts.length === 3) {
            const dealDate = new Date(
              parseInt(dateParts[2]),
              parseInt(dateParts[0]) - 1,
              parseInt(dateParts[1])
            );

            if (!isNaN(dealDate.getTime())) {
              const startDate = new Date(filters.dateRange[0]);
              const endDate = new Date(filters.dateRange[1]);

              if (dealDate < startDate || dealDate > endDate) {
                return false;
              }
            }
          }
        } catch (error) {
          console.error('Error filtering by date:', error);
        }
      }
      
      return true;
    });
  }, [deals, filters]);
  
  // Sort deals by column
  const sortedDeals = useMemo(() => {
    const sorted = [...filteredDeals];
    
    sorted.sort((a, b) => {
      const key = sortConfig.key;
      if (!key) return 0;

      const valA = a[key];
      const valB = b[key];

      // Special handling for dates
      if (key.toLowerCase().includes('date') && valA && valB) {
        const partsA = valA.toString().split('/');
        const partsB = valB.toString().split('/');
        if (partsA.length === 3 && partsB.length === 3) {
          const dateA = new Date(parseInt(partsA[2]), parseInt(partsA[0]) - 1, parseInt(partsA[1]));
          const dateB = new Date(parseInt(partsB[2]), parseInt(partsB[0]) - 1, parseInt(partsB[1]));
          if (!isNaN(dateA) && !isNaN(dateB)) {
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
          }
        }
      }

      const numA = parseFloat(String(valA).replace(/[^0-9.-]/g, ''));
      const numB = parseFloat(String(valB).replace(/[^0-9.-]/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredDeals, sortConfig]);
  
  // Handle column sort
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };
  
  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      revenueRange: [0, Math.max(...(deals || []).map(d => d.Revenue || 0))],
      ebitdaRange: [2000000, Math.max(...(deals || []).map(d => d.EBITDA || 0))],
      pursuitsRange: [0, Math.max(...(deals || []).map(d => d['Total Pursuits'] || 0))],
      verticals: [],
      activities: [],
      regions: [],
      states: [],
      dateRange: [
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
      ],
      includeBrokers: false,
      includeSmartshareEnabled: true,
      includeInboundInquiryEnabled: true,
      dealIntentStatuses: ['active'],
      dealIntentTypes: ['sell']
    });
    setSelectedDeals([]);
  };
  
  // Manual refresh
  const handleManualRefresh = () => {
    fetchData();
  };
  
  // Toggle deal selection
  const toggleDealSelection = (deal) => {
    setSelectedDeals(prev => {
      const dealId = deal["Sellside Project: ID"] || deal["ID"] || deal["Deal ID"];
      const isSelected = prev.some(d => (d["Sellside Project: ID"] || d["ID"] || d["Deal ID"]) === dealId);
      
      if (isSelected) {
        return prev.filter(d => (d["Sellside Project: ID"] || d["ID"] || d["Deal ID"]) !== dealId);
      } else {
        return [...prev, deal];
      }
    });
  };
  
  // Copy formatted deals to clipboard
  const copyFormattedDeals = () => {
    if (selectedDeals.length === 0) return;
    
    // Create tab-separated table with just the basic deal info
    const headers = ['Deal', 'Revenue ($M)', 'EBITDA ($M)', 'ID'];
    const headerRow = headers.join('\t');
    
    const rows = selectedDeals.map(deal => {
      const dealName = deal["Sellside Project: Axial Opportunity"] || deal["Deal Name"] || deal["Opportunity"];
      const dealId = deal["Sellside Project: ID"] || deal["ID"] || deal["Deal ID"];
      
      return [
        dealName,
        deal.Revenue ? (deal.Revenue/1000000).toFixed(1) : 'N/A',
        deal.EBITDA ? (deal.EBITDA/1000000).toFixed(1) : 'N/A',
        dealId
      ].join('\t');
    });
    
    const tsvContent = [headerRow, ...rows].join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(tsvContent)
      .then(() => {
        alert('Deals copied to clipboard in tab-separated format!');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard. Please try a different browser.');
      });
  };
  
  // Function to toggle chart view mode
  const toggleChartViewMode = (chart) => {
    setChartViewMode(prev => ({
      ...prev,
      [chart]: prev[chart] === 'count' ? 'percentage' : 'count'
    }));
  };
  
  // Calculate summary statistics for dashboard
  const summaryStats = useMemo(() => {
    if (filteredDeals.length === 0) return null;
    
    return {
      totalDeals: filteredDeals.length,
      totalRevenue: filteredDeals.reduce((sum, deal) => sum + (deal.Revenue || 0), 0),
      avgRevenue:
        filteredDeals.reduce((sum, deal) => sum + (deal.Revenue || 0), 0) /
        filteredDeals.length,
      totalEBITDA: filteredDeals.reduce((sum, deal) => sum + (deal.EBITDA || 0), 0),
      avgEBITDA:
        filteredDeals.reduce((sum, deal) => sum + (deal.EBITDA || 0), 0) /
        filteredDeals.length,
    };
  }, [filteredDeals]);
  
  // Prepare data for charts
  const verticalChartData = useMemo(() => {
    if (filteredDeals.length === 0) return [];
    
    const counts = {};
    filteredDeals.forEach(deal => {
      const vertical = deal["Primary Supply Vertical"];
      if (vertical) {
        counts[vertical] = (counts[vertical] || 0) + 1;
      }
    });
    
    // Calculate percentages if in percentage mode
    const data = Object.entries(counts)
      .map(([name, value]) => {
        const percentage = (value / filteredDeals.length) * 100;
        return { name, value, percentage };
      })
      .sort((a, b) => b.value - a.value);
    
    return data;
  }, [filteredDeals]);
  
  const activityChartData = useMemo(() => {
    if (filteredDeals.length === 0) return [];
    
    const counts = {};
    filteredDeals.forEach(deal => {
      const activity = deal["Primary Supply Activity"];
      if (activity) {
        counts[activity] = (counts[activity] || 0) + 1;
      }
    });
    
    // Calculate percentages if in percentage mode
    const data = Object.entries(counts)
      .map(([name, value]) => {
        const percentage = (value / filteredDeals.length) * 100;
        return { name, value, percentage };
      })
      .sort((a, b) => b.value - a.value);
    
    return data;
  }, [filteredDeals]);
  
  // Chart colors with better palette
  const COLORS = [
    '#4361EE', '#3A0CA3', '#7209B7', '#F72585', '#4CC9F0', 
    '#4895EF', '#560BAD', '#B5179E', '#F15BB5', '#00BBF9',
    '#F77F00', '#FCBF49', '#EAE2B7', '#D62828', '#9E0059'
  ];
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading Deal Analytics Dashboard...</h2>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Trying multiple data sources...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">Deal Tease Dashboard</h1>
          
          <div className="space-y-2 md:space-y-0 md:space-x-2 md:flex md:items-center">
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Refresh Data
            </button>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-2 flex justify-between items-center">
          <div className="text-gray-600">
            {filteredDeals.length} deals displayed out of {deals.length} total
            {lastRefresh && (
              <span className="ml-4 text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Display error if any */}
        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-red-800 font-medium">Error loading data:</div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
            <button 
              onClick={handleManualRefresh}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}
      </header>
      
      <div className="space-y-6 mb-6">
        {/* Summary Stats Card */}
        {summaryStats && (
          <div className="bg-white shadow rounded-lg p-4 w-full">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Summary Statistics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-indigo-500 font-semibold">Total Deals</div>
                <div className="text-2xl font-bold text-gray-800">{summaryStats.totalDeals}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-teal-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-teal-500 font-semibold">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-800">${(summaryStats.totalRevenue / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-amber-500 font-semibold">Avg. Revenue</div>
                <div className="text-2xl font-bold text-gray-800">${(summaryStats.avgRevenue / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-purple-500 font-semibold">Total EBITDA</div>
                <div className="text-2xl font-bold text-gray-800">${(summaryStats.totalEBITDA / 1000000).toFixed(1)}M</div>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-pink-500 font-semibold">Avg. EBITDA</div>
                <div className="text-2xl font-bold text-gray-800">${(summaryStats.avgEBITDA / 1000000).toFixed(1)}M</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Vertical Distribution Chart */}
        <div className="bg-white shadow rounded-lg p-4 w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Deals by Vertical</h2>
            <div className="flex space-x-2">
              <div className="relative inline-block">
                <button 
                  onClick={() => toggleChartViewMode('vertical')} 
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full hover:bg-purple-700 shadow-sm transition-colors"
                >
                  {chartViewMode.vertical === 'count' ? 'Show %' : 'Show Count'}
                </button>
              </div>
            </div>
          </div>
          <div id="vertical-chart">
            {verticalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(400, verticalChartData.length * 30)}>
                <BarChart data={verticalChartData} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 20 }}>
                  <XAxis 
                    type="number" 
                    domain={[0, chartViewMode.vertical === 'count' ? 'dataMax' : (
                      Math.max(...verticalChartData.map(item => item.percentage)) > 90 ? 100 : 
                      Math.min(100, Math.ceil(Math.max(...verticalChartData.map(item => item.percentage)) * 1.1))
                    )]} 
                    tickCount={5}
                    tickFormatter={value => chartViewMode.vertical === 'percentage' ? `${value}%` : value}
                    padding={{ right: 30 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={160} 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const entry = props.payload;
                      return chartViewMode.vertical === 'count' 
                        ? [`${value} deals (${entry.percentage.toFixed(1)}%)`, 'Count'] 
                        : [`${value.toFixed(1)}% (${entry.value} deals)`, 'Percentage'];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: 'none',
                      padding: '10px'
                    }}
                  />
                  <Bar 
                    dataKey={chartViewMode.vertical === 'count' ? 'value' : 'percentage'}
                    fill="#8884d8" 
                    barSize={24}
                    radius={[0, 4, 4, 0]}
                    background={{ fill: '#f0f0f0' }}
                    label={(props) => {
                      const { x, y, width, height, value } = props;
                      const displayValue = chartViewMode.vertical === 'count' 
                        ? value 
                        : `${value.toFixed(1)}%`;
                      
                      const threshold = chartViewMode.vertical === 'count' ? 15 : 5;
                      const isSmallValue = value < threshold;
                      
                      return (
                        <text 
                          x={isSmallValue ? (x + width + 5) : (x + width - 5)} 
                          y={y + height / 2} 
                          fill={isSmallValue ? "#555555" : "#000000"}
                          textAnchor={isSmallValue ? "start" : "end"}
                          dominantBaseline="central"
                          fontSize="12"
                          fontWeight="bold"
                        >
                          {displayValue}
                        </text>
                      );
                    }}
                  >
                    {verticalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-56 text-gray-500">
                No data to display
              </div>
            )}
          </div>
        </div>
        
        {/* Activity Distribution Chart */}
        <div className="bg-white shadow rounded-lg p-4 w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Deals by Activity</h2>
            <div className="flex space-x-2">
              <div className="relative inline-block">
                <button 
                  onClick={() => toggleChartViewMode('activity')}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full hover:bg-purple-700 shadow-sm transition-colors"
                  title="Toggle between count and percentage view"
                >
                  {chartViewMode.activity === 'count' ? 'Show %' : 'Show Count'}
                </button>
              </div>
            </div>
          </div>
          <div id="activity-chart">
            {activityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(400, activityChartData.length * 30)}>
                <BarChart data={activityChartData} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 20 }}>
                  <XAxis 
                    type="number" 
                    domain={[0, chartViewMode.activity === 'count' ? 'dataMax' : (
                      Math.max(...activityChartData.map(item => item.percentage)) > 90 ? 100 : 
                      Math.min(100, Math.ceil(Math.max(...activityChartData.map(item => item.percentage)) * 1.1))
                    )]} 
                    tickCount={5}
                    tickFormatter={value => chartViewMode.activity === 'percentage' ? `${value}%` : value}
                    padding={{ right: 30 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={160} 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const entry = props.payload;
                      return chartViewMode.activity === 'count' 
                        ? [`${value} deals (${entry.percentage.toFixed(1)}%)`, 'Count'] 
                        : [`${value.toFixed(1)}% (${entry.value} deals)`, 'Percentage'];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: 'none',
                      padding: '10px'
                    }}
                  />
                  <Bar 
                    dataKey={chartViewMode.activity === 'count' ? 'value' : 'percentage'}
                    fill="#8884d8" 
                    barSize={24}
                    radius={[0, 4, 4, 0]}
                    background={{ fill: '#f0f0f0' }}
                    label={(props) => {
                      const { x, y, width, height, value } = props;
                      const displayValue = chartViewMode.activity === 'count' 
                        ? value 
                        : `${value.toFixed(1)}%`;
                      
                      const threshold = chartViewMode.activity === 'count' ? 15 : 5;
                      const isSmallValue = value < threshold;
                      
                      return (
                        <text 
                          x={isSmallValue ? (x + width + 5) : (x + width - 5)} 
                          y={y + height / 2} 
                          fill={isSmallValue ? "#555555" : "#000000"}
                          textAnchor={isSmallValue ? "start" : "end"}
                          dominantBaseline="central"
                          fontSize="12"
                          fontWeight="bold"
                        >
                          {displayValue}
                        </text>
                      );
                    }}
                  >
                    {activityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-56 text-gray-500">
                No data to display
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Filters Panel */}
        <div className="bg-white shadow rounded-lg p-4 lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          
          {/* Revenue Range Filter */}
          {deals.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenue Range: ${(filters?.revenueRange?.[0] / 1000000 || 0).toFixed(1)}M - ${(filters?.revenueRange?.[1] / 1000000 || 0).toFixed(1)}M
              </label>
              <div className="px-2">
                <input
                  type="range"
                  min="0"
                  max={Math.max(...deals.map(d => d.Revenue || 0)) / 1000000}
                  step="0.1"
                  value={(filters?.revenueRange?.[0] / 1000000 || 0).toFixed(1)}
                  onChange={(e) => handleFilterChange('revenueRange', [
                    parseFloat(e.target.value) * 1000000, 
                    filters.revenueRange[1]
                  ])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="range"
                  min="0"
                  max={Math.max(...deals.map(d => d.Revenue || 0)) / 1000000}
                  step="0.1"
                  value={(filters?.revenueRange?.[1] / 1000000 || 0).toFixed(1)}
                  onChange={(e) => handleFilterChange('revenueRange', [
                    filters.revenueRange[0],
                    parseFloat(e.target.value) * 1000000
                  ])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 px-2">
                <span>$0M</span>
                <span>${(Math.max(...deals.map(d => d.Revenue || 0)) / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          )}
          
          {/* EBITDA Range Filter */}
          {deals.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EBITDA Range: ${(filters?.ebitdaRange?.[0] / 1000000 || 0).toFixed(1)}M - ${(filters?.ebitdaRange?.[1] / 1000000 || 0).toFixed(1)}M
              </label>
              <div className="px-2">
                <input
                  type="range"
                  min="0"
                  max={Math.max(...deals.map(d => d.EBITDA || 0)) / 1000000}
                  step="0.1"
                  value={(filters?.ebitdaRange?.[0] / 1000000 || 0).toFixed(1)}
                  onChange={(e) => handleFilterChange('ebitdaRange', [
                    parseFloat(e.target.value) * 1000000, 
                    filters.ebitdaRange[1]
                  ])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="range"
                  min="0"
                  max={Math.max(...deals.map(d => d.EBITDA || 0)) / 1000000}
                  step="0.1"
                  value={(filters?.ebitdaRange?.[1] / 1000000 || 0).toFixed(1)}
                  onChange={(e) => handleFilterChange('ebitdaRange', [
                    filters.ebitdaRange[0],
                    parseFloat(e.target.value) * 1000000
                  ])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 px-2">
                <span>$0M</span>
                <span>${(Math.max(...deals.map(d => d.EBITDA || 0)) / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          )}
          
          {/* Vertical Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Supply Vertical
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.verticals.map(vertical => (
                <div key={vertical} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`vertical-${vertical}`}
                    checked={filters.verticals.includes(vertical)}
                    onChange={(e) => {
                      const newVerticals = e.target.checked
                        ? [...filters.verticals, vertical]
                        : filters.verticals.filter(v => v !== vertical);
                      handleFilterChange('verticals', newVerticals);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`vertical-${vertical}`} className="text-sm">
                    {vertical}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Activity Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Supply Activity
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.activities.map(activity => (
                <div key={activity} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`activity-${activity}`}
                    checked={filters.activities.includes(activity)}
                    onChange={(e) => {
                      const newActivities = e.target.checked
                        ? [...filters.activities, activity]
                        : filters.activities.filter(a => a !== activity);
                      handleFilterChange('activities', newActivities);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`activity-${activity}`} className="text-sm">
                    {activity}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Pursuits Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Pursuits: {filters?.pursuitsRange?.[0] || 0} - {filters?.pursuitsRange?.[1] || 150}
            </label>
            <div className="px-2">
              <input
                type="range"
                min="0"
                max={deals.length > 0 ? Math.max(...deals.map(d => d["Total Pursuits"] || 0)) : 150}
                step="1"
                value={filters?.pursuitsRange?.[0] || 0}
                onChange={(e) => handleFilterChange('pursuitsRange', [
                  parseInt(e.target.value), 
                  filters.pursuitsRange[1]
                ])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="range"
                min="0"
                max={deals.length > 0 ? Math.max(...deals.map(d => d["Total Pursuits"] || 0)) : 150}
                step="1"
                value={filters?.pursuitsRange?.[1] || 150}
                onChange={(e) => handleFilterChange('pursuitsRange', [
                  filters.pursuitsRange[0],
                  parseInt(e.target.value)
                ])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 px-2">
              <span>0</span>
              <span>{deals.length > 0 ? Math.max(...deals.map(d => d["Total Pursuits"] || 0)) : 150}</span>
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Market Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.dateRange[0]}
                  onChange={(e) => handleFilterChange('dateRange', [
                    e.target.value,
                    filters.dateRange[1]
                  ])}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.dateRange[1]}
                  onChange={(e) => handleFilterChange('dateRange', [
                    filters.dateRange[0],
                    e.target.value
                  ])}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Region Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.regions.map(region => (
                <div key={region} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`region-${region}`}
                    checked={filters.regions.includes(region)}
                    onChange={(e) => {
                      const newRegions = e.target.checked
                        ? [...filters.regions, region]
                        : filters.regions.filter(r => r !== region);
                      handleFilterChange('regions', newRegions);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`region-${region}`} className="text-sm">
                    {region}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* State/Province Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State/Province
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.states.map(state => (
                <div key={state} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`state-${state}`}
                    checked={filters.states.includes(state)}
                    onChange={(e) => {
                      const newStates = e.target.checked
                        ? [...filters.states, state]
                        : filters.states.filter(s => s !== state);
                      handleFilterChange('states', newStates);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`state-${state}`} className="text-sm">
                    {state}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Broker Filter */}
          <div className="mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="include-brokers"
                checked={filters.includeBrokers}
                onChange={(e) => handleFilterChange('includeBrokers', e.target.checked)}
                className="h-4 w-4 mr-2"
              />
              <label htmlFor="include-brokers" className="text-sm font-medium text-gray-700">
                Include Broker Deals
              </label>
            </div>
          </div>
          
          {/* Smartshare Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Smartshare Status
            </label>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="smartshare-all"
                  name="smartshare"
                  checked={filters?.includeSmartshareEnabled === null}
                  onChange={() => handleFilterChange('includeSmartshareEnabled', null)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="smartshare-all" className="text-sm">All</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="smartshare-enabled"
                  name="smartshare"
                  checked={filters?.includeSmartshareEnabled === true}
                  onChange={() => handleFilterChange('includeSmartshareEnabled', true)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="smartshare-enabled" className="text-sm">Enabled Only</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="smartshare-disabled"
                  name="smartshare"
                  checked={filters?.includeSmartshareEnabled === false}
                  onChange={() => handleFilterChange('includeSmartshareEnabled', false)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="smartshare-disabled" className="text-sm">Disabled Only</label>
              </div>
            </div>
          </div>
          
          {/* Inbound Inquiry Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inbound Inquiry Status
            </label>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="inbound-all"
                  name="inbound"
                  checked={filters?.includeInboundInquiryEnabled === null}
                  onChange={() => handleFilterChange('includeInboundInquiryEnabled', null)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="inbound-all" className="text-sm">All</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="inbound-enabled"
                  name="inbound"
                  checked={filters?.includeInboundInquiryEnabled === true}
                  onChange={() => handleFilterChange('includeInboundInquiryEnabled', true)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="inbound-enabled" className="text-sm">Enabled Only</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="inbound-disabled"
                  name="inbound"
                  checked={filters?.includeInboundInquiryEnabled === false}
                  onChange={() => handleFilterChange('includeInboundInquiryEnabled', false)}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="inbound-disabled" className="text-sm">Disabled Only</label>
              </div>
            </div>
          </div>
          
          {/* Deal Intent Status Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Intent Status
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.dealIntentStatuses.map(status => (
                <div key={status} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`status-${status}`}
                    checked={filters?.dealIntentStatuses?.includes(status)}
                    onChange={(e) => {
                      const newStatuses = e.target.checked
                        ? [...(filters?.dealIntentStatuses || []), status]
                        : (filters?.dealIntentStatuses || []).filter(s => s !== status);
                      handleFilterChange('dealIntentStatuses', newStatuses);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`status-${status}`} className="text-sm">
                    {status}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Deal Intent Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Intent
            </label>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              {filterOptions.dealIntentTypes.map(intent => (
                <div key={intent} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`intent-${intent}`}
                    checked={filters?.dealIntentTypes?.includes(intent)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...(filters?.dealIntentTypes || []), intent]
                        : (filters?.dealIntentTypes || []).filter(i => i !== intent);
                      handleFilterChange('dealIntentTypes', newTypes);
                    }}
                    className="h-4 w-4 mr-2"
                  />
                  <label htmlFor={`intent-${intent}`} className="text-sm">
                    {intent}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Deals Table */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Deals Table</h2>
              <div className="space-x-2">
                <button 
                  onClick={copyFormattedDeals}
                  className={`px-4 py-2 ${
                    selectedDeals.length > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
                  } text-white rounded`}
                  disabled={selectedDeals.length === 0}
                >
                  Copy {selectedDeals.length} Selected Deal{selectedDeals.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort(col)}
                      >
                        {col} {sortConfig.key === col && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDeals.map((deal, index) => {
                    const dealId = deal["Sellside Project: ID"] || deal["ID"] || deal["Deal ID"] || index;
                    const isSelected = selectedDeals.some(d => (d["Sellside Project: ID"] || d["ID"] || d["Deal ID"]) === dealId);
                    
                    return (
                      <tr
                        key={dealId}
                        className={`hover:bg-gray-50 ${isSelected ? 'bg-green-50' : ''}`}
                      >
                        <td className="px-2 py-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDealSelection(deal)}
                            className="h-4 w-4"
                          />
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate"
                          >
                            {col === 'Sellside Project: ID' && deal[col] ? (
                              <a
                                href={`https://axialinc.lightning.force.com/lightning/r/Sellside_Project__c/${deal[col]}/view`}
                                className="text-blue-600 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {deal[col]}
                              </a>
                            ) : col === "Revenue" && deal[col] ? (
                              `$${(deal[col] / 1000000).toFixed(1)}M`
                            ) : col === "EBITDA" && deal[col] ? (
                              `$${(deal[col] / 1000000).toFixed(1)}M`
                            ) : col === "EBITDA Margin" && deal[col] ? (
                              `${(deal[col] * 100).toFixed(1)}%`
                            ) : (
                              <span className={deal[col] ? "" : "text-gray-400"}>
                                {deal[col] !== undefined ? deal[col].toString() : '-'}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedDeals.length > 0 && (
                <div className="py-3 text-center text-gray-500">
                  Showing all {sortedDeals.length} deals. Use filters to narrow down results if needed.
                </div>
              )}
            </div>
          </div>
          
          {/* Selected Deals for Export */}
          {selectedDeals.length > 0 && (
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Selected Deals for Export</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue ($M)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EBITDA ($M)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedDeals.map((deal, index) => {
                      const dealName = deal["Sellside Project: Axial Opportunity"] || deal["Deal Name"] || deal["Opportunity"];
                      const dealId = deal["Sellside Project: ID"] || deal["ID"] || deal["Deal ID"];
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-2 text-sm text-gray-500">{dealName}</td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                            {deal.Revenue ? `$${(deal.Revenue/1000000).toFixed(1)}M` : 'N/A'}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                            {deal.EBITDA ? `$${(deal.EBITDA/1000000).toFixed(1)}M` : 'N/A'}
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">{dealId}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex space-x-2">
                <button 
                  onClick={copyFormattedDeals}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Copy Table to Clipboard
                </button>
                <button 
                  onClick={() => setSelectedDeals([])}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealAnalyticsDashboard;
