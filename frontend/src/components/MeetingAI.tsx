import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import {
  BrainCircuit,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface ActionItem {
  task: string;
  assignee: string | null;
  deadline: string | null;
}

interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
}

interface MeetingAIProps {
  meetingId: string;
}

const API_URL = `${import.meta.env.VITE_API_URL}/api/ai`;

function MeetingAI({ meetingId }: MeetingAIProps) {
  const [meetingText, setMeetingText] = useState("");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const fetchSummary = async () => {
      try {
        const token = sessionStorage.getItem("token");

        const response = await axios.get(`${API_URL}/${meetingId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (active) {
          setSummary(response.data.summary);
        }
      } catch (err) {
        if (active && axios.isAxiosError(err)) {
          if (err.response?.status !== 404) {
            setError("Unable to load the previous AI summary.");
          }
        }
      }
    };

    fetchSummary();

    return () => {
      active = false;
    };
  }, [meetingId]);

  const generateSummary = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!meetingText.trim()) {
      setError("Please enter your meeting notes.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = sessionStorage.getItem("token");

      const response = await axios.post(
        `${API_URL}/${meetingId}/generate`,
        {
          meetingText,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSummary(response.data.summary);
      setSuccess("AI summary generated and saved successfully!");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
            "Unable to generate the AI summary."
        );
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meeting-ai">
      <div className="ai-header">
        <BrainCircuit size={24} />
        <div>
          <h2>AI Meeting Intelligence</h2>
          <p>Generate summaries and action items from your meeting notes.</p>
        </div>
      </div>

      <form onSubmit={generateSummary} className="ai-form">
        <label htmlFor="meeting-notes">Meeting Notes</label>

        <textarea
          id="meeting-notes"
          placeholder="Enter your meeting discussion or transcript here..."
          value={meetingText}
          onChange={(e) => setMeetingText(e.target.value)}
          rows={6}
          maxLength={30000}
          required
        />

        <button
          type="submit"
          className="ai-generate-btn"
          disabled={loading || !meetingText.trim()}
        >
          {loading ? (
            <>
              <Loader2 size={18} />
              Generating Summary...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Generate AI Summary
            </>
          )}
        </button>
      </form>

      {error && <p className="ai-error">{error}</p>}
      {success && <p className="ai-success">{success}</p>}

      {summary && (
        <div className="ai-results">
          <section className="ai-result-card">
            <h3>
              <BrainCircuit size={20} />
              Meeting Summary
            </h3>

            <p>{summary.summary}</p>
          </section>

          <section className="ai-result-card">
            <h3>
              <ClipboardList size={20} />
              Key Discussion Points
            </h3>

            {summary.keyPoints.length === 0 ? (
              <p>No key discussion points identified.</p>
            ) : (
              <ul>
                {summary.keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="ai-result-card">
            <h3>
              <CheckCircle2 size={20} />
              Action Items
            </h3>

            {summary.actionItems.length === 0 ? (
              <p>No action items identified.</p>
            ) : (
              <div className="ai-action-list">
                {summary.actionItems.map((item, index) => (
                  <div className="ai-action-item" key={index}>
                    <strong>{item.task}</strong>

                    <span>
                      Assigned to: {item.assignee || "Not assigned"}
                    </span>

                    <span>
                      Deadline: {item.deadline || "Not specified"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default MeetingAI;