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
  Link2,
  X,
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
  const [showJoinForm, setShowJoinForm] = useState(false);

  const [meetingLink, setMeetingLink] = useState("");

  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const token = sessionStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(API_URL, {
        headers,
      });

      setMeetings(response.data.meetings);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message || "Failed to load meetings"
        );
      } else {
        setError("Failed to load meetings");
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
        {
          headers,
        }
      );

      setTitle("");
      setDescription("");
      setScheduledAt("");
      setShowForm(false);

      await fetchMeetings();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message || "Failed to create meeting"
        );
      } else {
        setError("Failed to create meeting");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    const input = meetingLink.trim();

    if (!input) {
      setError("Please enter a meeting link or meeting ID.");
      return;
    }

    let meetingId = input;

    try {
      if (input.includes("/")) {
        const url = new URL(input);

        if (url.origin !== window.location.origin) {
          setError("Please enter a valid IntellMeet meeting link.");
          return;
        }

        const match = url.pathname.match(
          /^\/meeting\/([^/]+)\/?$/
        );

        if (!match) {
          setError("Invalid meeting link.");
          return;
        }

        meetingId = match[1];
      }

      const validMeetingId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!validMeetingId.test(meetingId)) {
        setError("Please enter a valid meeting ID or link.");
        return;
      }

      setJoining(true);

      await axios.get(`${API_URL}/${meetingId}`, {
        headers,
      });

      setMeetingLink("");
      setShowJoinForm(false);

      navigate(`/meeting/${meetingId}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError("Your session has expired. Please log in again.");
        } else if (
          err.response?.status === 403 ||
          err.response?.status === 404
        ) {
          setError(
            "Meeting not found or access denied. Ask the host to invite your account."
          );
        } else {
          setError(
            err.response?.data?.message || "Unable to join meeting."
          );
        }
      } else {
        setError("Please enter a valid IntellMeet meeting link.");
      }
    } finally {
      setJoining(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (
      !window.confirm("Are you sure you want to delete this meeting?")
    ) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/${id}`, {
        headers,
      });

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

  const openCreateForm = () => {
    setError("");
    setShowJoinForm(false);
    setShowForm(true);
  };

  const openJoinForm = () => {
    setError("");
    setShowForm(false);
    setShowJoinForm(true);
  };

  const closeJoinForm = () => {
    setShowJoinForm(false);
    setMeetingLink("");
    setError("");
  };

  const upcomingMeetings = meetings.filter(
    (meeting) =>
      meeting.status === "scheduled" &&
      new Date(meeting.scheduledAt) > new Date()
  );

  const completedMeetings = meetings.filter(
    (meeting) => meeting.status === "completed"
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

          <button onClick={openCreateForm}>
            <Plus size={20} />
            Create Meeting
          </button>

          <button onClick={openJoinForm}>
            <Link2 size={20} />
            Join Meeting
          </button>
        </nav>

        <button
          className="logout-btn"
          onClick={handleLogout}
        >
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>Meeting Dashboard</h1>
            <p>
              Manage your meetings and collaborate with your team.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <button
              className="join-meeting-btn"
              onClick={openJoinForm}
            >
              <Link2 size={18} />
              Join Meeting
            </button>

            <button
              className="primary-btn"
              onClick={openCreateForm}
            >
              <Plus size={18} />
              New Meeting
            </button>
          </div>
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
            <strong>{completedMeetings.length}</strong>
          </div>
        </section>

        {error && (
          <p className="dashboard-error">
            {error}
          </p>
        )}

        {showJoinForm && (
          <section className="meeting-form-card">
            <div className="join-form-header">
              <div>
                <h2>Join a Meeting</h2>
                <p>
                  Enter the meeting link or meeting ID shared by
                  the host.
                </p>
              </div>

              <button
                type="button"
                className="join-close-btn"
                onClick={closeJoinForm}
                aria-label="Close join meeting form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleJoinMeeting}>
              <input
                type="text"
                placeholder="Paste meeting link or Meeting ID"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                required
              />

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeJoinForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={joining || !meetingLink.trim()}
                >
                  <Video size={18} />
                  {joining ? "Joining..." : "Join Meeting"}
                </button>
              </div>
            </form>
          </section>
        )}

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

              <p>
                Create your first meeting or join a meeting
                using an invitation link.
              </p>

              <button
                className="join-meeting-btn"
                onClick={openJoinForm}
              >
                <Link2 size={18} />
                Join a Meeting
              </button>
            </div>
          ) : (
            <div className="meeting-grid">
              {meetings.map((meeting) => (
                <div
                  className="meeting-card"
                  key={meeting._id}
                >
                  <div className="meeting-card-header">
                    <Video size={22} />

                    <span
                      className={`status-badge ${meeting.status}`}
                    >
                      {meeting.status}
                    </span>
                  </div>

                  <h3>{meeting.title}</h3>

                  <p>
                    {meeting.description ||
                      "No description provided"}
                  </p>

                  <div className="meeting-date">
                    <Clock size={16} />
                    {new Date(
                      meeting.scheduledAt
                    ).toLocaleString()}
                  </div>

                  <div className="meeting-actions">
                    <button
                      className="join-btn"
                      onClick={() =>
                        navigate(
                          `/meeting/${meeting.meetingId}`
                        )
                      }
                    >
                      <Video size={16} />
                      Join
                    </button>

                    <button
                      className="icon-btn"
                      onClick={() =>
                        copyMeetingLink(meeting.meetingId)
                      }
                      title="Copy meeting link"
                    >
                      <Copy size={18} />
                    </button>

                    <button
                      className="icon-btn delete"
                      onClick={() =>
                        deleteMeeting(meeting._id)
                      }
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