import React from "react";
import { FileText, X, Trash2, Clock, Plus } from "lucide-react";

function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Pure frontend UI for managing saved drafts of a module.
// Parent is responsible for saving/loading draft payloads.
export default function DraftModal({
  open,
  title,
  drafts,
  onLoad,
  onDelete,
  onClearAll,
  onStartNew,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center items-start overflow-y-auto pt-24 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-lg p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-[#0088CC]" size={20} /> Saved Drafts
            {title && <span className="text-sm font-medium text-gray-400">— {title}</span>}
          </h3>
          <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={onClose} />
        </div>

        {drafts.length === 0 ? (
          <div className="text-center text-gray-500 py-12 text-sm">
            No drafts saved yet.
            <br />
            <span className="text-xs text-gray-400">Use "Save Draft" on the creation form to keep your inputs temporarily.</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {drafts.map(d => (
                <div key={d.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-[#0088CC] transition">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-800 text-sm truncate">{d.label || "Untitled"}</div>
                    {(d.customer || d.company) && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {d.customer}{d.customer && d.company ? " • " : ""}{d.company}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock size={12} /> {fmtTime(d.savedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    <button
                      onClick={() => onLoad(d)}
                      className="bg-[#0088CC] hover:bg-[#006FA8] text-white text-xs font-semibold px-4 py-2 rounded-lg"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => onDelete(d.id)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                      title="Delete draft"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 mt-4 border-t">
              <button
                onClick={() => { if (window.confirm("Delete all saved drafts?")) onClearAll(); }}
                className="text-red-500 hover:underline text-sm font-semibold"
              >
                Clear All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={onStartNew}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
                >
                  <Plus size={15} /> Start New
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}