import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Video,
  CalendarDays,
  Plus,
  Copy,
  Trash2,
  LogOut,
  Users,
  Clock,
} from "lucide-react";

interface Meeting {
  _id: string;
  meetingId: string;
  title: string;
  description: string;
  scheduledAt: string;
  status: string;
}

const API_URL = `${import.meta.env.VITE_API_URL}/api/meetings`;

function Dashboard() {
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = sessionStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(API_URL, { headers });
      setMeetings(response.data.meetings);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to load meetings");
      }
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const createMeeting = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(
        API_URL,
        {
          title,
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
        },
        { headers }
      );

      setTitle("");
      setDescription("");
      setScheduledAt("");
      setShowForm(false);

      await fetchMeetings();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to create meeting");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this meeting?")) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/${id}`, { headers });
      await fetchMeetings();
    } catch {
      setError("Failed to delete meeting");
    }
  };

  const copyMeetingLink = async (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;

    try {
      await navigator.clipboard.writeText(link);
      alert("Meeting link copied!");
    } catch {
      setError("Unable to copy the meeting link");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  const upcomingMeetings = meetings.filter(
    (meeting) =>
      meeting.status === "scheduled" &&
      new Date(meeting.scheduledAt) > new Date()
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Video size={28} />
          <span>IntellMeet</span>
        </div>

        <nav className="sidebar-nav">
          <a href="/dashboard" className="active">
            <CalendarDays size={20} />
            Dashboard
          </a>

          <button onClick={() => setShowForm(true)}>
            <Plus size={20} />
            Create Meeting
          </button>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>Meeting Dashboard</h1>
            <p>Manage your meetings and collaborate with your team.</p>
          </div>

          <button
            className="primary-btn"
            onClick={() => setShowForm(true)}
          >
            <Plus size={18} />
            New Meeting
          </button>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <Video size={26} />
            <h3>Total Meetings</h3>
            <strong>{meetings.length}</strong>
          </div>

          <div className="stat-card">
            <CalendarDays size={26} />
            <h3>Upcoming Meetings</h3>
            <strong>{upcomingMeetings.length}</strong>
          </div>

          <div className="stat-card">
            <Users size={26} />
            <h3>Completed Meetings</h3>
            <strong>
              {meetings.filter((m) => m.status === "completed").length}
            </strong>
          </div>
        </section>

        {error && <p className="dashboard-error">{error}</p>}

        {showForm && (
          <section className="meeting-form-card">
            <h2>Create New Meeting</h2>

            <form onSubmit={createMeeting}>
              <input
                type="text"
                placeholder="Meeting Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <textarea
                placeholder="Meeting Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Meeting"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="meetings-section">
          <div className="section-header">
            <h2>Your Meetings</h2>
            <span>{meetings.length} meetings</span>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state">
              <Video size={42} />
              <h3>No meetings yet</h3>
              <p>Create your first meeting to get started.</p>
            </div>
          ) : (
            <div className="meeting-grid">
              {meetings.map((meeting) => (
                <div className="meeting-card" key={meeting._id}>
                  <div className="meeting-card-header">
                    <Video size={22} />
                    <span className={`status-badge ${meeting.status}`}>
                      {meeting.status}
                    </span>
                  </div>

                  <h3>{meeting.title}</h3>

                  <p>{meeting.description || "No description provided"}</p>

                  <div className="meeting-date">
                    <Clock size={16} />
                    {new Date(meeting.scheduledAt).toLocaleString()}
                  </div>

                  <div className="meeting-actions">
                    <button
                      className="join-btn"
                      onClick={() =>
                        navigate(`/meeting/${meeting.meetingId}`)
                      }
                    >
                      <Video size={16} />
                      Join
                    </button>

                    <button
                      className="icon-btn"
                      onClick={() => copyMeetingLink(meeting.meetingId)}
                      title="Copy meeting link"
                    >
                      <Copy size={18} />
                    </button>

                    <button
                      className="icon-btn delete"
                      onClick={() => deleteMeeting(meeting._id)}
                      title="Delete meeting"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;