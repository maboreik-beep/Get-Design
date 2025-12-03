import React, { useState, useEffect } from 'react';
import { User, Lead, Template, UserRole } from '../types';

interface AdminDashboardProps {
  PUBLIC_APP_URL: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ PUBLIC_APP_URL }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<UserRole | null>(localStorage.getItem('role') as UserRole);
  const [activeTab, setActiveTab] = useState<'leads' | 'templates' | 'users'>('leads');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Forms State
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'designer' });
  const [newTemplate, setNewTemplate] = useState({ title: '', category: 'logo', url: '', thumbnail_url: '' });

  useEffect(() => {
    if (token) {
      if (activeTab === 'leads') fetchLeads();
      if (activeTab === 'templates') fetchTemplates();
      if (activeTab === 'users' && role === 'admin') fetchUsers();
    }
  }, [token, activeTab, role]);

  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error("Session expired");
      }
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiCall('/auth/login', 'POST', { username, password });
      setToken(data.token);
      setRole(data.role);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      setError(null);
    } catch (e) {
      // error handled in apiCall
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  const fetchLeads = async () => setLeads(await apiCall('/leads'));
  const fetchTemplates = async () => setTemplates(await apiCall('/templates'));
  const fetchUsers = async () => setUsers(await apiCall('/users'));

  const updateLead = async (id: number, status: string, notes: string) => {
    await apiCall(`/leads/${id}`, 'PUT', { status, notes });
    fetchLeads();
  };

  const exportLeads = async () => {
    try {
      const res = await fetch('/api/leads/export', { headers: { 'Authorization': `Bearer ${token}` } });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.xlsx';
      document.body.appendChild(a);
      a.click();
    } catch (e) { console.error(e); }
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall('/templates', 'POST', newTemplate);
    setNewTemplate({ title: '', category: 'logo', url: '', thumbnail_url: '' });
    fetchTemplates();
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall('/users', 'POST', newUser);
    setNewUser({ username: '', password: '', role: 'designer' });
    fetchUsers();
  };

  const deleteItem = async (type: 'leads'|'templates'|'users', id: number) => {
    if(!confirm("Are you sure?")) return;
    await apiCall(`/${type}/${id}`, 'DELETE');
    if (type === 'leads') fetchLeads();
    if (type === 'templates') fetchTemplates();
    if (type === 'users') fetchUsers();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
          <h1 className="text-2xl font-bold text-white text-center mb-6">System Access</h1>
          {error && <div className="bg-red-900/50 text-red-200 p-3 rounded text-sm text-center">{error}</div>}
          <input type="text" placeholder="Username / Email" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green outline-none" />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green outline-none" />
          <button className="w-full bg-brand-green text-black font-bold py-3 rounded-lg hover:bg-lime-500">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-brand-green">GetDesign Admin</h1>
            <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{role}</span>
          </div>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-300">Logout</button>
        </div>
      </header>

      {/* Navigation */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-4 border-b border-gray-800 mb-8">
          {['leads', 'templates'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-4 text-sm font-medium uppercase tracking-wider ${activeTab === tab ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-500 hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
          {role === 'admin' && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-4 text-sm font-medium uppercase tracking-wider ${activeTab === 'users' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-500 hover:text-white'}`}
            >
              Users
            </button>
          )}
        </div>

        {/* --- LEADS TAB --- */}
        {activeTab === 'leads' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Leads Management</h2>
              {(role === 'admin' || role === 'coordinator') && (
                <button onClick={exportLeads} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold">
                  Export to Excel
                </button>
              )}
            </div>
            
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Interest</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Notes</th>
                    {role === 'admin' && <th className="p-4">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-800/50">
                      <td className="p-4 text-gray-500 text-sm">{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{lead.name}</div>
                        <div className="text-xs text-gray-400">{lead.company}</div>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="text-brand-green">{lead.email}</div>
                        <div className="text-gray-400">{lead.phone}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-300 capitalize">{lead.design_interest}</td>
                      <td className="p-4">
                        <select 
                          disabled={role === 'designer'}
                          value={lead.status}
                          onChange={(e) => updateLead(lead.id, e.target.value, lead.notes || '')}
                          className={`bg-black/50 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-brand-green
                            ${lead.status === 'new' ? 'text-blue-400' : lead.status === 'closed' ? 'text-green-400' : 'text-yellow-400'}
                          `}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <input 
                          disabled={role === 'designer'}
                          type="text" 
                          value={lead.notes || ''}
                          onChange={(e) => updateLead(lead.id, lead.status, e.target.value)}
                          placeholder="Add notes..."
                          className="bg-transparent border-b border-gray-700 focus:border-brand-green outline-none text-sm text-gray-300 w-full"
                        />
                      </td>
                      {role === 'admin' && (
                        <td className="p-4">
                          <button onClick={() => deleteItem('leads', lead.id)} className="text-red-500 hover:text-red-400">&times;</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TEMPLATES TAB --- */}
        {activeTab === 'templates' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">Design Templates</h2>
            
            {(role === 'admin' || role === 'designer') && (
              <form onSubmit={addTemplate} className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input required value={newTemplate.title} onChange={e=>setNewTemplate({...newTemplate, title: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                </div>
                <div className="w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select value={newTemplate.category} onChange={e=>setNewTemplate({...newTemplate, category: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white">
                    <option value="logo">Logo</option>
                    <option value="social">Social</option>
                    <option value="web">Web</option>
                    <option value="brochure">Brochure</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">Link URL (Canva/Figma)</label>
                  <input required value={newTemplate.url} onChange={e=>setNewTemplate({...newTemplate, url: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                </div>
                <button className="bg-brand-green text-black font-bold px-6 py-2 rounded hover:bg-lime-500">Add</button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-brand-green transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{t.category}</span>
                    {role === 'admin' && <button onClick={() => deleteItem('templates', t.id)} className="text-red-500 opacity-0 group-hover:opacity-100">&times;</button>}
                  </div>
                  <h3 className="font-bold text-lg mb-1">{t.title}</h3>
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-brand-green text-sm hover:underline break-all">{t.url}</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- USERS TAB (Admin Only) --- */}
        {activeTab === 'users' && role === 'admin' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-6">User Management</h2>
             
             <form onSubmit={addUser} className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Email / Username</label>
                  <input required value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Password</label>
                  <input required value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white" />
                </div>
                <div className="w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white">
                    <option value="admin">Admin</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="designer">Designer</option>
                  </select>
                </div>
                <button className="bg-brand-green text-black font-bold px-6 py-2 rounded hover:bg-lime-500">Create</button>
             </form>

             <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-4">Username</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Created</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {users.map(u => (
                      <tr key={u.id}>
                        <td className="p-4">{u.username}</td>
                        <td className="p-4 capitalize text-brand-green">{u.role}</td>
                        <td className="p-4 text-gray-500 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-4">
                          <button onClick={() => deleteItem('users', u.id)} className="text-red-500 hover:text-red-400">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};
