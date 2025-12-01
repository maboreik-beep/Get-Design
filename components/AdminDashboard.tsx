import React, { useState, useEffect } from 'react';
import { LeadRecord, GeneratedDesignRecord } from '../types';
import { TRANSLATIONS } from '../constants';

export const AdminDashboard: React.FC = () => {
  const [lang] = useState('en'); // Assuming admin dashboard is primarily English for now
  const t = TRANSLATIONS[lang];

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [designs, setDesigns] = useState<GeneratedDesignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'designs'>('leads');

  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  useEffect(() => {
    // Check for token on component mount
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      if (activeTab === 'leads') {
        fetchLeads();
      } else {
        fetchDesigns();
      }
    }
  }, [isAuthenticated, activeTab]); // Rerun when isAuthenticated changes or tab changes

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || t.admin_invalid_credentials);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setLoginError(t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/leads', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setLeads(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
      setDataError(t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesigns = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams();
      if (searchEmail) queryParams.append('email', searchEmail);
      if (searchPhone) queryParams.append('phone', searchPhone);

      const response = await fetch(`/api/admin/designs?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setDesigns(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err) {
      console.error("Failed to fetch designs:", err);
      setDataError(t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setLeads([]);
    setDesigns([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">{t.admin_login_title}</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">{t.admin_username}</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">{t.admin_password}</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                disabled={loading}
              />
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button 
              type="submit" 
              className="w-full bg-brand-green hover:bg-lime-500 text-black font-bold py-3 rounded-xl transition-colors"
              disabled={loading}
            >
              {loading ? 'Logging in...' : t.admin_login_btn}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="container mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-brand-green">
            {activeTab === 'leads' ? t.admin_leads_title : t.admin_designs_title}
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={activeTab === 'leads' ? fetchLeads : fetchDesigns} 
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Loading...' : t.admin_refresh}
            </button>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
              disabled={loading}
            >
              {t.admin_logout}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 mb-6">
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'leads' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('leads')}
            disabled={loading}
          >
            {t.admin_tab_leads}
          </button>
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'designs' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('designs')}
            disabled={loading}
          >
            {t.admin_tab_designs}
          </button>
        </div>

        {dataError && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-100 rounded-lg">
            <span>{dataError}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-green"></div>
          </div>
        ) : (
          <>
            {activeTab === 'leads' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                      <th className="p-4 font-semibold">{t.admin_col_date}</th>
                      <th className="p-4 font-semibold">{t.admin_col_name}</th>
                      <th className="p-4 font-semibold">{t.admin_col_company}</th>
                      <th className="p-4 font-semibold">{t.admin_col_email}</th>
                      <th className="p-4 font-semibold">{t.admin_col_phone}</th>
                      <th className="p-4 font-semibold">{t.admin_col_interest}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          {t.admin_no_leads}
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-medium">{lead.name}</td>
                          <td className="p-4 text-gray-300">{lead.company}</td>
                          <td className="p-4">
                            <a href={`mailto:${lead.email}`} className="text-brand-green hover:underline text-sm">
                              {lead.email}
                            </a>
                          </td>
                          <td className="p-4 text-gray-400 text-sm">{lead.phone}</td>
                          <td className="p-4 text-gray-300 text-sm">{lead.design_interest}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'designs' && (
              <>
                {/* Search / Filter for Designs */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4">
                  <input
                    type="email"
                    placeholder={t.admin_search_email}
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="flex-1 min-w-[200px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder={t.admin_search_phone}
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="flex-1 min-w-[200px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <button 
                    onClick={fetchDesigns} 
                    className="px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-500 transition-colors"
                    disabled={loading}
                  >
                    Search
                  </button>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <th className="p-4 font-semibold">{t.admin_col_date}</th>
                        <th className="p-4 font-semibold">{t.admin_col_design_type}</th>
                        <th className="p-4 font-semibold">{t.admin_col_business_name}</th>
                        <th className="p-4 font-semibold">{t.admin_col_email} / {t.admin_col_phone}</th>
                        <th className="p-4 font-semibold">{t.admin_col_image}</th>
                        <th className="p-4 font-semibold">{t.admin_col_template}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {designs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            {t.admin_no_designs}
                          </td>
                        </tr>
                      ) : (
                        designs.map((design) => (
                          <tr key={design.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              {new Date(design.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 font-medium capitalize text-sm">{design.design_type}</td>
                            <td className="p-4 text-gray-300 text-sm">{design.business_name}</td>
                            <td className="p-4 text-sm">
                              {design.contact_email && (
                                <a href={`mailto:${design.contact_email}`} className="text-brand-green hover:underline">
                                  {design.contact_email}
                                </a>
                              )}
                              {design.contact_email && design.contact_phone && <br/>}
                              {design.contact_phone && <span className="text-gray-400">{design.contact_phone}</span>}
                            </td>
                            <td className="p-4">
                              <img src={design.image_url} alt="Design Preview" className="w-20 h-20 object-contain rounded-md border border-gray-700" />
                            </td>
                            <td className="p-4">
                              {design.template_link ? (
                                <a href={design.template_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                                  View Template
                                </a>
                              ) : (
                                <span className="text-gray-500 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};