import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, AlertTriangle } from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../hooks/useCategories';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#6b7280', // gray
];

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function CategoryManager({ open, onClose }: CategoryManagerProps) {
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[9]);
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    createCategory.mutate(
      { name: name.trim(), color, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          setColor(PRESET_COLORS[9]);
        },
      }
    );
  };

  const handleStartEdit = (cat: { id: number; name: string; color: string; description: string | null }) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditDescription(cat.description || '');
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    updateCategory.mutate(
      {
        id: editingId,
        data: {
          name: editName.trim(),
          color: editColor,
          description: editDescription.trim() || undefined,
        },
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Manage Categories</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
          {/* Create form */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">New Category</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div>
              <p className="text-xs text-gray-500 mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c
                        ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || createCategory.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm
                font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
              {createCategory.isPending ? 'Creating...' : 'Create Category'}
            </button>
          </div>

          {/* Existing categories */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Existing Categories ({categories.length})
              </h3>

              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    {editingId === cat.id ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-6 h-6 rounded-full transition-all ${
                                editColor === c
                                  ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110'
                                  : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editName.trim() || updateCategory.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white
                              text-xs font-medium rounded-lg hover:bg-indigo-700
                              disabled:opacity-50 transition-colors"
                          >
                            <Check size={14} />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600
                              hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : deleteConfirmId === cat.id ? (
                      /* Delete confirmation */
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700 flex-1">
                          Delete "{cat.name}"? This will remove it from all videos.
                        </p>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deleteCategory.isPending}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium
                            rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600
                            hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Normal display */
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {cat.description}
                            </p>
                          )}
                        </div>
                        {cat.video_count !== undefined && (
                          <span className="text-xs text-gray-400">
                            {cat.video_count} videos
                          </span>
                        )}
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
