'use client';

import { useState, useMemo } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';


interface ContractListProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  onSelectContract: (contract: Contract | null) => void;
  onEditContract: (contract: Contract) => void;
  onDeleteContract: (contractId: string) => Promise<void>;
}

export default function ContractList({
  contracts,
  selectedContract,
  onSelectContract,
  onEditContract,
  onDeleteContract,
}: ContractListProps) {
 
  const getDisplayPrice = (contract: Contract) => {
  switch (contract.pricingType) {
    case 'timeseries':
      if (contract.priceTimeSeries?.length) {
        const average = contract.priceTimeSeries.reduce((sum, price) => sum + price, 0) / contract.priceTimeSeries.length;
        return average;
      }
      return contract.strikePrice;
    case 'escalation':
      // For escalation, could show the current year price, but for now show base
      return contract.strikePrice;
    case 'custom_time_of_day':
      if (contract.timeBasedPricing?.periods?.length) {
        // Calculate volume-weighted average if we had volume data, otherwise simple average
        const prices = contract.timeBasedPricing.periods.map(p => p.price);
        const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        return average;
      }
      return contract.timeBasedPricing?.defaultPrice || contract.strikePrice;
    default:
      return contract.strikePrice;
  }
};
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    state: 'all',
    status: 'all',
    pricingType: 'all',
    contractType: 'all',
    direction: 'all' // NEW: Added direction filter
  });
  const [showFilters, setShowFilters] = useState(false);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const uniqueStates = [...new Set(contracts.map(c => c.state))].sort();
    const uniqueContractTypes = [...new Set(contracts.map(c => c.unit || 'Energy'))].sort();
    const uniquePricingTypes = [...new Set(contracts.map(c => c.pricingType || 'fixed'))].sort();
    const uniqueDirections = [...new Set(contracts.map(c => c.direction || 'buy'))].sort();
    
    return {
      states: uniqueStates,
      contractTypes: uniqueContractTypes,
      pricingTypes: uniquePricingTypes,
      directions: uniqueDirections
    };
  }, [contracts]);

  // Filter contracts based on current filters
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      // Search filter (name, counterparty, category)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchableText = `${contract.name} ${contract.counterparty} ${contract.category}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }

      // Type filter
      if (filters.type !== 'all' && contract.type !== filters.type) return false;

      // State filter
      if (filters.state !== 'all' && contract.state !== filters.state) return false;

      // Status filter
      if (filters.status !== 'all' && contract.status !== filters.status) return false;

      // Pricing type filter
      if (filters.pricingType !== 'all' && (contract.pricingType || 'fixed') !== filters.pricingType) return false;

      // Contract type filter (unit field)
      if (filters.contractType !== 'all' && (contract.contractType || 'Energy') !== filters.contractType) return false;

      // Direction filter
      if (filters.direction !== 'all' && (contract.direction || 'buy') !== filters.direction) return false;

      return true;
    });
  }, [contracts, filters]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      type: 'all',
      state: 'all',
      status: 'all',
      pricingType: 'all',
      contractType: 'all',
      direction: 'all'
    });
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== 'all');
  
  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  const getDirectionColor = (direction: string) => {
    return direction === 'buy'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getPricingTypeLabel = (contract: Contract) => {
    switch (contract.pricingType) {
      case 'fixed': return 'Fixed';
      case 'escalation': return 'Escalation';
      case 'timeseries': return 'Time Series';
      case 'custom_time_of_day': return 'Time-of-Day';
      default: return 'Fixed';
    }
  };

  const getPricingTypeColor = (pricingType?: string) => {
    switch (pricingType) {
      case 'fixed': return 'bg-blue-100 text-blue-800';
      case 'escalation': return 'bg-green-100 text-green-800';
      case 'timeseries': return 'bg-purple-100 text-purple-800';
      case 'custom_time_of_day': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPricingDetails = (contract: Contract) => {
    const details: string[] = [];
    
    switch (contract.pricingType) {
      case 'escalation':
        if (contract.escalationRate) {
          details.push(`${contract.escalationRate}% p.a.`);
        }
        break;
      case 'timeseries':
        if (contract.priceTimeSeries?.length) {
          const min = Math.min(...contract.priceTimeSeries);
          const max = Math.max(...contract.priceTimeSeries);
          const avg = contract.priceTimeSeries.reduce((a, b) => a + b, 0) / contract.priceTimeSeries.length;
          details.push(`${contract.priceTimeSeries.length} periods`);
          details.push(`Avg: $${avg.toFixed(0)}`);
          if (min !== max) {
            details.push(`Range: $${min.toFixed(0)}-$${max.toFixed(0)}`);
          }
        }
        break;
      case 'custom_time_of_day':
        if (contract.timeBasedPricing?.periods?.length) {
          details.push(`${contract.timeBasedPricing.periods.length} periods`);
          const prices = contract.timeBasedPricing.periods.map(p => p.price);
          if (prices.length > 0) {
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            if (min !== max) {
              details.push(`$${min.toFixed(0)}-$${max.toFixed(0)}`);
            }
          }
        }
        break;
      default:
        // Fixed pricing - just show the strike price
        break;
    }
    
    return details;
  };

  const getDataSourceIcon = (contract: Contract) => {
    switch (contract.dataSource) {
      case 'csv_import': return '📊';
      case 'api_import': return '🔗';
      case 'manual': 
      default: return '✏️';
    }
  };

  const getVolumeDetails = (contract: Contract) => {
    const details: string[] = [];
    
    // Calculate average annual volume
    let averageAnnualVolume = 0;
    
    if (contract.timeSeriesData?.length && contract.yearsCovered?.length) {
      // If we have time series data, calculate average across years
      const totalVolume = contract.totalVolume || 0;
      const yearsCount = contract.yearsCovered.length;
      averageAnnualVolume = yearsCount > 0 ? totalVolume / yearsCount : totalVolume;
    } else {
      // Fall back to annual volume
      averageAnnualVolume = contract.annualVolume || 0;
    }
    
    const volumeLabel = contract.type === 'wholesale' 
      ? `${Math.round(averageAnnualVolume).toLocaleString()} MW`
      : `${Math.round(averageAnnualVolume).toLocaleString()} MWh`;
    
    details.push(volumeLabel);
    
    // Additional details
    if (contract.timeSeriesData?.length) {
      details.push(`${contract.timeSeriesData.length} periods`);
      if (contract.yearsCovered?.length) {
        details.push(`${contract.yearsCovered.length} years`);
      }
    } else {
      details.push(contract.volumeShape);
    }
    
    return details;
  };

  const handleDeleteClick = async (contract: Contract) => {
    const contractId = contract._id || contract.id?.toString();
    
    if (!contractId) {
      console.error('No contract ID found for deletion');
      alert('Cannot delete contract: No ID found');
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to delete "${contract.name}"?`);
    if (!confirmed) return;

    try {
      await onDeleteContract(contractId);
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    }
  };

  const handleRowClick = (contract: Contract) => {
    onSelectContract(contract);
  };

  // Generate unique key for each contract
  const getContractKey = (contract: Contract, index: number) => {
    if (contract._id) return `contract-${contract._id}`;
    if (contract.id) return `contract-id-${contract.id}`;
    return `contract-${contract.name}-${index}`;
  };

  // Check if contract is selected
  const isSelected = (contract: Contract) => {
    if (!selectedContract) return false;
    
    if (contract._id && selectedContract._id) {
      return contract._id === selectedContract._id;
    }
    if (contract.id && selectedContract.id) {
      return contract.id === selectedContract.id;
    }
    return contract.name === selectedContract.name;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          📋 Contract Portfolio
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {filteredContracts.length} of {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtered)'}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            🔍 Filters
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                {Object.values(filters).filter(v => v !== '' && v !== 'all').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Name, counterparty, category..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Trade Direction */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
              <select
                value={filters.direction}
                onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Directions</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>

            {/* Contract Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="offtake">Offtake</option>
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
              <select
                value={filters.state}
                onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All States</option>
                {filterOptions.states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            {/* Pricing Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pricing</label>
              <select
                value={filters.pricingType}
                onChange={(e) => setFilters(prev => ({ ...prev, pricingType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Pricing</option>
                {filterOptions.pricingTypes.map(type => (
                  <option key={type} value={type}>
                    {type === 'fixed' ? 'Fixed' : 
                     type === 'escalation' ? 'Escalation' :
                     type === 'timeseries' ? 'Time Series' :
                     type === 'custom_time_of_day' ? 'Time-of-Day' : type}
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Type (Unit) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contract Type</label>
              <select
                value={filters.contractType}
                onChange={(e) => setFilters(prev => ({ ...prev, contractType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {filterOptions.contractTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Spacer columns */}
            <div className="md:col-span-1 lg:col-span-2"></div>

            {/* Filter Actions */}
            <div className="md:col-span-3 lg:col-span-2 flex gap-2 items-end">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Quick Filter Chips */}
          {hasActiveFilters && (
            <div className="border-t border-gray-200 pt-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-600 font-medium">Active Filters:</span>
                {filters.search && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Search: "{filters.search}"
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                      className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.direction !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                    Direction: {filters.direction}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, direction: 'all' }))}
                      className="hover:bg-emerald-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.type !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    Type: {filters.type}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, type: 'all' }))}
                      className="hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.state !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    State: {filters.state}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, state: 'all' }))}
                      className="hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.status !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Status: {filters.status}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                      className="hover:bg-yellow-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.pricingType !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                    Pricing: {filters.pricingType}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, pricingType: 'all' }))}
                      className="hover:bg-orange-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.contractType !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                    Contract Type: {filters.contractType}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, contractType: 'all' }))}
                      className="hover:bg-pink-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {filteredContracts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-4">
            <div className="text-6xl mb-4">
              {hasActiveFilters ? '🔍' : '📄'}
            </div>
            <p className="text-lg">
              {hasActiveFilters ? 'No contracts match your filters' : 'No contracts found'}
            </p>
            <p className="text-sm">
              {hasActiveFilters ? 'Try adjusting your filter criteria' : 'Get started by adding your first contract'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-700 w-24">Actions</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-40">Name</th>
                <th className="text-left p-4 font-semibold text-gray-700">Direction</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-24">Type</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-24">Category</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-20">State</th>
                <th className="text-left p-4 font-semibold text-gray-700">Counterparty</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-28">Contract Type</th>   
                <th className="text-left p-4 font-semibold text-gray-700">Ave. Annual Volume</th>              
                <th className="text-left p-4 font-semibold text-gray-700">Ave. Pricing</th>
                <th className="text-left p-4 font-semibold text-gray-700">Period</th>
                <th className="text-left p-4 font-semibold text-gray-700 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract, index) => {
                const volumeDetails = getVolumeDetails(contract);
                const pricingDetails = getPricingDetails(contract);
                
                return (
                  <tr
                    key={getContractKey(contract, index)}
                    onClick={() => handleRowClick(contract)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      isSelected(contract)
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditContract(contract);
                          }}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(contract);
                          }}
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${contract.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="font-medium text-gray-900">{contract.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getDirectionColor(contract.direction || 'buy')}`}>
                        {contract.direction || 'buy'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getContractTypeColor(contract.type)}`}>
                        {contract.type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">{contract.category}</td>
                    <td className="p-4 text-gray-700">{contract.state}</td>
                    <td className="p-4 text-gray-700">{contract.counterparty}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contract.contractType === 'Green' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {contract.contractType || 'Energy'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium">{volumeDetails[0]}</span>
                        {volumeDetails.slice(1).map((detail, idx) => (
                          <span key={idx} className="text-xs text-blue-600">{detail}</span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">
                          ${getDisplayPrice(contract).toFixed(2)}/MWh
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPricingTypeColor(contract.pricingType)}`}>
                            {getPricingTypeLabel(contract)}
                          </span>
                        </div>
                        {pricingDetails.map((detail, idx) => (
                          <span key={idx} className="text-xs text-gray-500 mt-1">{detail}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div>{contract.startDate}</div>
                      <div>to {contract.endDate}</div>
                      {contract.tenor && (
                        <div className="text-blue-600 mt-1">
                          {contract.tenor.value} {contract.tenor.unit}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}