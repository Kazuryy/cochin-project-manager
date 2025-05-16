// frontend/src/pages/Dashboard.jsx
import React, { useState } from 'react';
import { FiFilter, FiHeart, FiRefreshCw } from 'react-icons/fi';

function Dashboard() {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  return (
    <div className="p-4">
      {/* Breadcrumb */}
      <div className="text-sm breadcrumbs mb-4">
        <ul>
          <li><a href="/">Home</a></li>
          <li>Sponsors</li>
        </ul>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn btn-sm btn-outline">
          <FiFilter className="mr-2" />
          Sponsors working with less than 20 creators
        </button>
        <button className="btn btn-sm btn-outline">Foods for pets</button>
        <button className="btn btn-sm btn-outline">Home DIY</button>
        <button className="btn btn-sm btn-outline">Small Tech Sponsors French</button>
        <button className="btn btn-sm btn-outline">Small Esport Sponsor</button>
        <button className="btn btn-sm btn-outline btn-circle">+</button>
      </div>

      <div className="flex gap-4">
        {/* Left Sidebar */}
        <div className="w-72">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-4">
              <div className="tabs tabs-boxed mb-4">
                <a className="tab tab-active">Filters</a>
                <a className="tab">My templates</a>
              </div>

              <h3 className="font-medium mb-3">brand informations</h3>
              
              {/* Search */}
              <div className="form-control mb-4">
                <div className="input-group">
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="btn btn-square" onClick={() => setSearchTerm('')}>
                      <span className="text-lg">×</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter by niches */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Filter by niches</h4>
                <div className="flex items-center gap-2 bg-base-200 p-2 rounded">
                  <span>Tech</span>
                  <button className="btn btn-xs btn-ghost">×</button>
                </div>
              </div>

              {/* Languages */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">languages</span>
                </label>
                <select className="select select-bordered w-full">
                  <option>Choose a language</option>
                </select>
              </div>

              {/* YouTuber speaking */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">YouTuber speaking</span>
                </label>
                <select className="select select-bordered w-full">
                  <option>Choose a language</option>
                </select>
              </div>

              {/* Affiliations */}
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Include affiliated videos</span>
                  <input type="checkbox" className="toggle" />
                </label>
              </div>

              {/* Minor sponsors */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Minor sponsors</h4>
                <label className="label cursor-pointer">
                  <span className="label-text">Only show minor sponsors</span>
                  <input type="checkbox" className="toggle" />
                </label>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">How many YouTubers they work with</span>
                  </label>
                  <input type="number" className="input input-bordered" value="10" />
                </div>
              </div>

              {/* Favorites */}
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">only favorite Sponsors</span>
                  <input 
                    type="checkbox" 
                    className="toggle"
                    checked={showFavorites}
                    onChange={(e) => setShowFavorites(e.target.checked)}
                  />
                </label>
              </div>

              <button className="btn btn-outline w-full mb-4">
                <FiRefreshCw className="mr-2" />
                Reset
              </button>

              <button className="btn btn-neutral w-full">
                Create new search template
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Table Controls */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select 
                    className="select select-bordered select-sm"
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  >
                    <option>10</option>
                    <option>20</option>
                    <option>50</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-outline">
                    <FiHeart className="mr-2" />
                    Only favorites
                  </button>
                  <button className="btn btn-sm btn-outline">
                    <FiRefreshCw className="mr-2" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sponsor</th>
                      <th>Operations</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="flex items-center gap-4">
                          <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-8">
                              <span>S</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-bold">SBMMOFF</div>
                            <div className="text-sm opacity-70">
                              SBMMOFF isn't a traditional VPN like Nord VPN, SBMMOFF is a COD VPN gaming...
                            </div>
                            <div className="mt-2">
                              <div className="badge badge-outline mr-2">Cyber Security</div>
                              <div className="badge badge-outline mr-2">Software</div>
                              <div className="badge badge-outline">Network Security</div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span>0 /week</span>
                          <span>0 /month</span>
                          <span>0 /year</span>
                        </div>
                      </td>
                      <td>23 days ago</td></tr>
                  </tbody>
                </table>
              </div>

              

              {/* Pagination */}
              <div className="flex justify-center mt-4">
                <div className="join">
                  <button className="join-item btn">«</button>
                  <button className="join-item btn btn-active">1</button>
                  <button className="join-item btn">»</button>
                </div>
              </div>
              {/* Bouton Save to TSV */}
              <div className="flex justify-end mt-4 mb-4">
                <button className="btn btn-primary">
                  Save to TSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;