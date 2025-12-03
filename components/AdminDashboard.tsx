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
  const [loginError, setLoginError] = useState('');
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
      
      if (res.status === 401 || res.status === 403) { 
        // Only logout if we are ALREADY logged in (token exists) and get a 401
        // This prevents the "Session Expired" error during the actual login attempt if we used this helper there
        logout(); 
        throw new Error("Session expired"); 
      }
      
      if (!res.ok) { 
        const err = await res.json(); 
        throw new Error(err.error || 'Request failed'); 
      }
      return await res.json();
    } catch (e: any) { 
      // alert(e.message); 
      console.error(e);
      throw e; 
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      // Use raw fetch here to handle 401 explicitly without triggering "Session Expired"
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.status === 401) {
        setLoginError("Invalid Username or Password");
        return;
      }

      if (!res.ok) {
        throw new Error('Login failed');
      }

      const data = await res.json();
      setToken(data.token); 
      setRole(data.role);
      localStorage.setItem('token', data.token); 
      localStorage.setItem('role', data.role);
    } catch (e: any) {
      setLoginError(e.message || "Connection error");
    }
  };

  const logout = () => { 
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null); 
    setRole(null);
  };

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
          {loginError && <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm p-3 rounded">{loginError}</div>}
          <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white" />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white" />
          <button className="w-full bg-brand-green text-black font-bold py-3 rounded-lg hover:bg-white transition-colors">Login</button>
        </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
           <h1 className="text-xl font-bold text-brand-green">GetDesign Admin <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded ml-2 uppercase">{role}</span></h1>
           <button onClick={logout} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </header>
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-4 border-b border-gray-800 mb-8 overflow-x-auto">
           {['leads', 'tasks', 'templates', 'users'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-3 px-4 uppercase tracking-wider whitespace-nowrap ${activeTab === tab ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>
           ))}
        </div>

        {activeTab === 'tasks' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Design Tasks</h2>
             {tasks.length === 0 ? <p className="text-gray-500">No tasks found.</p> : (
             <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-4">ID</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Assigned To</th>
                      <th className="p-4">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tasks.map(task => (
                      <tr key={task.id} className="hover:bg-gray-800/50">
                        <td className="p-4 text-xs text-gray-500">#{task.id}</td>
                        <td className="p-4">
                           <div className="font-bold text-white">{task.lead_name || 'Unknown'}</div>
                           <div className="text-xs text-gray-400">{task.lead_company}</div>
                        </td>
                        <td className="p-4 uppercase text-xs font-bold text-brand-green">{task.type}</td>
                        <td className="p-4">
                           <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })} className={`bg-black/50 border border-gray-700 rounded p-1 text-xs outline-none ${task.status==='completed'?'text-green-400':task.status==='pending'?'text-yellow-400':'text-blue-400'}`}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                           </select>
                        </td>
                        <td className="p-4">
                           <select value={task.assigned_to || ''} onChange={(e) => updateTask(task.id, { assigned_to: e.target.value })} className="bg-black/50 border border-gray-700 rounded p-1 text-xs outline-none w-32 text-gray-300">
                              <option value="">Unassigned</option>
                              {users.filter(u => u.role === 'designer').map(u => (
                                <option key={u.id} value={u.id}>{u.username}</option>
                              ))}
                           </select>
                        </td>
                        <td className="p-4">
                            {task.output_url ? (
                                <a href={task.output_url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs underline">View Design</a>
                            ) : (
                                <span className="text-gray-600 text-xs">No Output</span>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Templates</h2>
             <form onSubmit={addTemplate} className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                   <label className="text-xs text-gray-400 mb-1 block">Title</label>
                   <input required value={newTemplate.title} onChange={e=>setNewTemplate({...newTemplate, title: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full" />
                </div>
                <div className="w-full md:w-40">
                   <label className="text-xs text-gray-400 mb-1 block">Category</label>
                   <select value={newTemplate.category} onChange={e=>setNewTemplate({...newTemplate, category: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full">
                      <option value="logo">Logo</option><option value="web">Website</option><option value="social">Social Media</option><option value="brochure">Brochure</option>
                   </select>
                </div>
                <div className="flex-1 w-full">
                   <label className="text-xs text-gray-400 mb-1 block">Thumbnail (Image URL)</label>
                   <input required value={newTemplate.thumbnail_url} onChange={e=>setNewTemplate({...newTemplate, thumbnail_url: e.target.value})} className="bg-black/50 border border-gray-700 rounded p-2 text-white w-full" />
                </div>
                <button className="bg-brand-green text-black font-bold px-6 py-2 rounded h-10 w-full md:w-auto">Add</button>
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

        {activeTab === 'leads' && (
           <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Leads</h2>
             {leads.length === 0 ? <p className="text-gray-500">No leads found.</p> : (
               <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
                 <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Company</th>
                            <th className="p-4">Contact</th>
                            <th className="p-4">Interest</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-gray-800/50">
                                <td className="p-4 text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                                <td className="p-4 font-bold text-white">{lead.name}</td>
                                <td className="p-4 text-gray-300">{lead.company}</td>
                                <td className="p-4 text-sm">
                                    <div className="text-white">{lead.email}</div>
                                    <div className="text-gray-500 text-xs">{lead.phone}</div>
                                </td>
                                <td className="p-4 text-brand-green uppercase text-xs font-bold">{lead.design_interest}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
               </div>
             )}
           </div>
        )}
        
        {activeTab === 'users' && (
           <div className="animate-fade-in">
             <h2 className="text-2xl font-bold mb-4">Users</h2>
             <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400">User management is currently limited to database initialization.</p>
                <div className="mt-4">
                    {users.map(u => (
                        <div key={u.id} className="border-b border-gray-800 py-2 flex justify-between">
                            <span>{u.username}</span>
                            <span className="text-xs uppercase bg-gray-800 px-2 py-1 rounded text-gray-400">{u.role}</span>
                        </div>
                    ))}
                </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};