import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PricePoint {
  time: string;
  price: number;
  date: Date;
  year: number;
  month: number;
  monthName: string;
  state: string;
  type: string;
  financialYear: number;
  calendarYear: number;
  scenario: string;
  period: string;
  curve: string;
}

interface TimeSeriesData {
  month: string;
  [key: string]: string | number; // For dynamic state/type data
}

export default function PriceCurvesTab() {
  const [priceData, setPriceData] = useState<{ [key: string]: PricePoint[] }>({});
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Chart configuration
  const [viewMode, setViewMode] = useState<'states' | 'types'>('states');
  const [selectedState, setSelectedState] = useState('NSW');
  const [selectedType, setSelectedType] = useState('Energy');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedScenario, setSelectedScenario] = useState('Central');
  const [selectedCurve, setSelectedCurve] = useState('Aurora Jan 2025 Intervals');
  const [timeInterval, setTimeInterval] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');
  const [showRawData, setShowRawData] = useState(false);

  // Available options (will be populated from API response)
  const [availableStates, setAvailableStates] = useState(['NSW', 'VIC', 'QLD', 'SA']);
  const [availableTypes, setAvailableTypes] = useState(['Energy']);
  const [availableScenarios, setAvailableScenarios] = useState(['Central']);
  const [availableYears, setAvailableYears] = useState(['2025', '2026', '2027', '2028', '2029', '2030', 'all']);

  const timeIntervals = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  // Colors for different lines
  const stateColors = {
    NSW: '#3B82F6', // Blue
    VIC: '#10B981', // Green
    QLD: '#F59E0B', // Yellow
    SA: '#EF4444',  // Red
    WA: '#8B5CF6'   // Purple
  };

  const typeColors = {
    Energy: '#3B82F6', // Blue
    Green: '#10B981',  // Green
    gas: '#F59E0B',    // Yellow
    coal: '#6B7280'    // Gray
  };

  // Fetch price data
  const fetchPriceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allData: { [key: string]: PricePoint[] } = {};
      
      if (viewMode === 'states') {
        // Fetch data for all states with selected type
        for (const state of availableStates) {
          const params = new URLSearchParams({
            state: state,
            type: selectedType,
            year: selectedYear,
            scenario: selectedScenario,
            curve: selectedCurve
          });
          
          console.log(`Fetching data for ${state}:`, `/api/price-curves?${params}`);
          
          const response = await fetch(`/api/price-curves?${params}`);
          const result = await response.json();
          
          if (result.success && result.marketPrices) {
            // Combine all series for this state
            Object.entries(result.marketPrices).forEach(([seriesKey, points]) => {
              allData[`${state}`] = points as PricePoint[];
            });
          }
        }
      } else {
        // Fetch data for all types with selected state
        for (const type of availableTypes) {
          const params = new URLSearchParams({
            state: selectedState,
            type: type,
            year: selectedYear,
            scenario: selectedScenario,
            curve: selectedCurve
          });
          
          console.log(`Fetching data for ${type}:`, `/api/price-curves?${params}`);
          
          const response = await fetch(`/api/price-curves?${params}`);
          const result = await response.json();
          
          if (result.success && result.marketPrices) {
            // Combine all series for this type
            Object.entries(result.marketPrices).forEach(([seriesKey, points]) => {
              allData[`${type}`] = points as PricePoint[];
            });
          }
        }
      }
      
      setPriceData(allData);
      
      // Transform data for time series chart
      const chartData = transformToTimeSeriesData(allData);
      setTimeSeriesData(chartData);
      
    } catch (err) {
      console.error('Error fetching price data:', err);
      setError('Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available options from API
  const fetchAvailableOptions = async () => {
    try {
      const response = await fetch('/api/price-curves?curve=' + selectedCurve);
      const result = await response.json();
      
      if (result.success) {
        setAvailableStates(result.availableStates || ['NSW', 'VIC', 'QLD', 'SA']);
        setAvailableTypes(result.availableTypes || ['Energy']);
        setAvailableScenarios(result.availableScenarios || ['Central']);
        setAvailableYears(result.financialYears ? [...result.financialYears.map(String), 'all'] : ['2025', 'all']);
      }
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  };

  // Transform price data to time series format
  const transformToTimeSeriesData = (data: { [key: string]: PricePoint[] }): TimeSeriesData[] => {
    const allDataPoints: { [identifier: string]: { date: Date, price: number }[] } = {};
    
    // Collect all data points by identifier
    Object.entries(data).forEach(([seriesKey, points]) => {
      points.forEach(point => {
        const identifier = seriesKey; // NSW, VIC, Energy, etc.
        
        if (!allDataPoints[identifier]) {
          allDataPoints[identifier] = [];
        }
        
        allDataPoints[identifier].push({
          date: new Date(point.date),
          price: point.price
        });
      });
    });
    
    // Sort each identifier's data by date
    Object.keys(allDataPoints).forEach(identifier => {
      allDataPoints[identifier].sort((a, b) => a.date.getTime() - b.date.getTime());
    });
    
    // Find the overall date range
    const allDates = Object.values(allDataPoints).flat().map(d => d.date);
    if (allDates.length === 0) return [];
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Generate time intervals
    const timePoints: { date: Date, label: string }[] = [];
    
    if (timeInterval === 'monthly') {
      const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      while (current <= maxDate) {
        timePoints.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (timeInterval === 'quarterly') {
      const startYear = minDate.getFullYear();
      const endYear = maxDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        for (let quarter = 0; quarter < 4; quarter++) {
          const quarterStart = new Date(year, quarter * 3, 1);
          if (quarterStart >= minDate && quarterStart <= maxDate) {
            timePoints.push({
              date: quarterStart,
              label: `Q${quarter + 1} ${year}`
            });
          }
        }
      }
    } else { // yearly
      const startYear = minDate.getFullYear();
      const endYear = maxDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        timePoints.push({
          date: new Date(year, 0, 1),
          label: year.toString()
        });
      }
    }
    
    // Aggregate data for each time point
    const timeSeriesData: TimeSeriesData[] = timePoints.map(({ date, label }) => {
      const dataPoint: TimeSeriesData = { month: label };
      
      Object.entries(allDataPoints).forEach(([identifier, points]) => {
        let relevantPoints: number[] = [];
        
        if (timeInterval === 'monthly') {
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear() && p.date.getMonth() === date.getMonth())
            .map(p => p.price);
        } else if (timeInterval === 'quarterly') {
          const quarterStart = date.getMonth();
          const quarterEnd = quarterStart + 2;
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear() && 
                        p.date.getMonth() >= quarterStart && 
                        p.date.getMonth() <= quarterEnd)
            .map(p => p.price);
        } else { // yearly
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear())
            .map(p => p.price);
        }
        
        if (relevantPoints.length > 0) {
          const average = relevantPoints.reduce((sum, price) => sum + price, 0) / relevantPoints.length;
          dataPoint[identifier] = Math.round(average * 100) / 100;
        }
      });
      
      return dataPoint;
    });
    
    return timeSeriesData.filter(point => 
      Object.keys(point).length > 1
    );
  };

  // Get line configuration for chart
  const getLineConfig = () => {
    if (viewMode === 'states') {
      return availableStates.map(state => ({
        key: state,
        color: stateColors[state as keyof typeof stateColors] || '#6B7280',
        name: state
      }));
    } else {
      return availableTypes.map(type => ({
        key: type,
        color: typeColors[type as keyof typeof typeColors] || '#6B7280',
        name: type
      }));
    }
  };

  // Load available options on mount
  useEffect(() => {
    fetchAvailableOptions();
  }, [selectedCurve]);

  // Fetch data when parameters change
  useEffect(() => {
    if (availableStates.length > 0 && availableTypes.length > 0) {
      fetchPriceData();
    }
  }, [viewMode, selectedState, selectedType, selectedYear, selectedScenario, selectedCurve, availableStates, availableTypes]);

  // Re-aggregate when time interval changes
  useEffect(() => {
    if (Object.keys(priceData).length > 0) {
      const chartData = transformToTimeSeriesData(priceData);
      setTimeSeriesData(chartData);
    }
  }, [timeInterval, priceData]);

  const lineConfig = getLineConfig();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          📈 Price Curves Viewer
        </h1>
        
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View Mode
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'states' | 'types')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="states">Compare States</option>
              <option value="types">Compare Types</option>
            </select>
          </div>
          
          {viewMode === 'types' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {availableStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          )}
          
          {viewMode === 'states' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {availableTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Financial Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years' : `FY${year}`}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {availableScenarios.map(scenario => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Interval
            </label>
            <select
              value={timeInterval}
              onChange={(e) => setTimeInterval(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {timeIntervals.map(interval => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={fetchPriceData}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Chart Summary */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📊 Chart Summary
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-600">View Mode</div>
              <div className="font-semibold">
                {viewMode === 'states' ? 'Comparing States' : 'Comparing Types'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">
                {viewMode === 'states' ? 'Type' : 'State'}
              </div>
              <div className="font-semibold">
                {viewMode === 'states' ? selectedType : selectedState}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Financial Year</div>
              <div className="font-semibold">
                {selectedYear === 'all' ? 'All Years' : `FY${selectedYear}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Scenario</div>
              <div className="font-semibold">{selectedScenario}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Data Points</div>
              <div className="font-semibold">{timeSeriesData.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Time Series Chart */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📈 Price Curves Over Time
          </h2>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                
                {lineConfig.map(({ key, color, name }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    name={name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Price Statistics */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📊 Price Statistics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {lineConfig.map(({ key, color, name }) => {
              const prices = timeSeriesData
                .map(d => d[key])
                .filter(p => typeof p === 'number') as number[];
              
              if (prices.length === 0) return null;
              
              const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              
              return (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <h3 className="font-semibold">{name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average:</span>
                      <span className="font-medium">${avg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min:</span>
                      <span className="font-medium">${min.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max:</span>
                      <span className="font-medium">${max.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Range:</span>
                      <span className="font-medium">${(max - min).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Data Table */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              🔍 Raw Time Series Data
            </h2>
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {showRawData ? '🔼 Collapse' : '🔽 Expand'}
            </button>
          </div>
          
          {showRawData && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Time Period</th>
                    {lineConfig.map(({ key, name }) => (
                      <th key={key} className="px-3 py-2 text-left">
                        {name} ($/MWh)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSeriesData.slice(0, 50).map((row, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium">{row.month}</td>
                      {lineConfig.map(({ key }) => (
                        <td key={key} className="px-3 py-2">
                          {typeof row[key] === 'number' 
                            ? `${(row[key] as number).toFixed(2)}`
                            : '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {timeSeriesData.length > 50 && (
                <div className="text-gray-500 text-center py-2">
                  ... and {timeSeriesData.length - 50} more data points
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Data Message */}
      {!loading && !error && timeSeriesData.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📈</div>
          <div className="text-gray-600">
            Configure your view settings and click "Refresh Data" to load price curves
          </div>
        </div>
      )}
    </div>
  );
}