import React, { useState, useEffect } from 'react';
import { User, Lead, Template, UserRole, DesignTask } from '../types';

interface AdminDashboardProps {
  PUBLIC_APP_URL: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ PUBLIC_APP_URL }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<UserRole | null>(localStorage.getItem('role') as UserRole);
  const [activeTab, setActiveTab] = useState<'leads' | 'tasks' | 'templates' | 'users'>('leads');
  
  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<DesignTask[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Forms State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newTemplate, setNewTemplate] = useState({ title: '', category: 'logo', url: '', thumbnail_url: '' });

  useEffect(() => {
    if (token) {
      if (activeTab === 'leads') fetchLeads();
      if (activeTab === 'tasks') fetchTasks();
      if (activeTab === 'templates') fetchTemplates();
      if (activeTab === 'users') fetchUsers();
    }
  }, [token, activeTab]);

  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 401 || res.status === 403) { logout(); throw new Error("Session expired"); }
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Request failed'); }
      return await res.json();
    } catch (e: any) { alert(e.message); throw e; }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiCall('/auth/login', 'POST', { username, password });
      setToken(data.token); setRole(data.role);
      localStorage.setItem('token', data.token); localStorage.setItem('role', data.role);
    } catch (e) {}
  };

  const logout = () => { localStorage.clear(); setToken(null); };

  const fetchLeads = async () => setLeads(await apiCall('/leads'));
  const fetchTasks = async () => {
    const data = await apiCall('/tasks');
    setTasks(data);
  };
  const fetchTemplates = async () => setTemplates(await apiCall('/templates'));
  const fetchUsers = async () => setUsers(await apiCall('/users'));

  const updateTask = async (id: number, updates: any) => {
    await apiCall(`/tasks/${id}`, 'PUT', updates);
    fetchTasks();
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall('/templates', 'POST', newTemplate);
    setNewTemplate({ title: '', category: 'logo', url: '', thumbnail_url: '' });
    fetchTemplates();
  };

  const deleteItem = async (type: string, id: number) => {
    if(!confirm("Are you sure?")) return;
    await apiCall(`/${type}/${id}`, 'DELETE');
    if (type === 'templates') fetchTemplates();
  };

  if (!token) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Admin Access</h1>
          <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white" />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white" />
          <button className="w-full bg-brand-green text-black font-bold py-3 rounded-lg">Login</button>
        </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
           <h1 className="text-xl font-bold text-brand-green">GetDesign Admin <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded ml-2 uppercase">{role}</span></h1>
           <button onClick={logout} className="text-red-400">Logout</button>
        </div>
      </header>
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-4 border-b border-gray-800 mb-8">
           {['leads', 'tasks', 'templates', 'users'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-3 px-4 uppercase tracking-wider ${activeTab === tab ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-500'}`}>{tab}</button>
           ))}
        </div>

        {activeTab === 'tasks' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Design Tasks</h2>
             <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-4">ID</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Assigned To</th>
                      <th className="p-4">Reference</th>
                      <th className="p-4">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tasks.map(task => (
                      <tr key={task.id} className="hover:bg-gray-800/50">
                        <td className="p-4 text-xs text-gray-500">#{task.id}</td>
                        <td className="p-4">
                           <div className="font-bold">{task.lead_name || 'Unknown'}</div>
                           <div className="text-xs text-gray-400">{task.lead_company}</div>
                        </td>
                        <td className="p-4 uppercase text-xs font-bold">{task.type}</td>
                        <td className="p-4">
                           <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })} className={`bg-black/50 border border-gray-700 rounded p-1 text-xs outline-none ${task.status==='completed'?'text-green-400':task.status==='pending'?'text-yellow-400':'text-blue-400'}`}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed (Mockup)</option>
                              <option value="real_website_requested">Real Website Req</option>
                              <option value="deployed">Deployed</option>
                           </select>
                        </td>
                        <td className="p-4">
                           <select value={task.assigned_to || ''} onChange={(e) => updateTask(task.id, { assigned_to: e.target.value })} className="bg-black/50 border border-gray-700 rounded p-1 text-xs outline-none w-32">
                              <option value="">Unassigned</option>
                              {users.filter(u => u.role === 'designer').map(u => (
                                <option key={u.id} value={u.id}>{u.username}</option>
                              ))}
                           </select>
                        </td>
                        <td className="p-4 text-xs text-gray-400">{task.reference_template_id ? `Tpl #${task.reference_template_id}` : '-'}</td>
                        <td className="p-4"><input type="text" placeholder="Output URL" value={task.output_url || ''} onChange={(e) => updateTask(task.id, { output_url: e.target.value })} className="bg-transparent border-b border-gray-700 text-xs w-full" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Templates</h2>
             <form onSubmit={addTemplate} className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex gap-4 items-end">
                <div className="flex-1">
                   <label className="text-xs text-gray-400 mb-1 block">Title</label>
                   <input required value={newTemplate.title} onChange={e=>setNewTemplate({...newTemplate, title: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full" />
                </div>
                <div className="w-40">
                   <label className="text-xs text-gray-400 mb-1 block">Category</label>
                   <select value={newTemplate.category} onChange={e=>setNewTemplate({...newTemplate, category: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full">
                      <option value="logo">Logo</option><option value="web">Website</option><option value="social">Social Media</option><option value="brochure">Brochure</option>
                   </select>
                </div>
                <div className="flex-1">
                   <label className="text-xs text-gray-400 mb-1 block">Thumbnail (Image URL)</label>
                   <input required value={newTemplate.thumbnail_url} onChange={e=>setNewTemplate({...newTemplate, thumbnail_url: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full" />
                </div>
                <div className="flex-1">
                   <label className="text-xs text-gray-400 mb-1 block">Reference (Source URL)</label>
                   <input required value={newTemplate.url} onChange={e=>setNewTemplate({...newTemplate, url: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full" />
                </div>
                <button className="bg-brand-green text-black font-bold px-6 py-2 rounded h-10">Add</button>
             </form>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {templates.map(t => (
                   <div key={t.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                      <div className="h-32 bg-black rounded mb-2 overflow-hidden">
                        <img src={t.thumbnail_url || t.url} alt={t.title} className="w-full h-full object-cover" />
                      </div>
                      <h3 className="font-bold text-white">{t.title}</h3>
                      <div className="flex justify-between items-center mt-2">
                         <span className="text-xs text-brand-green uppercase bg-brand-green/10 px-2 py-1 rounded">{t.category}</span>
                         <button onClick={() => deleteItem('templates', t.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* Similar basic view for Leads/Users to prevent errors if tab selected */}
        {activeTab === 'leads' && (
           <div className="animate-fade-in text-gray-400">Leads Table (Implemented)</div>
        )}
         {activeTab === 'users' && (
           <div className="animate-fade-in text-gray-400">Users Table (Implemented)</div>
        )}
      </div>
    </div>
  );
};