import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileJson, CheckCircle, AlertCircle, Loader2, Image } from 'lucide-react';
import { useImportFile } from '../../hooks/useImport';
import { downloadThumbnailBatch } from '../../api/client';
import type { ImportResult } from '../../types';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const importFile = useImportFile();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<{
    downloaded: number;
    remaining: number;
  } | null>(null);
  const thumbnailAbortRef = useRef(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setThumbnailProgress(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    multiple: false,
  });

  const downloadThumbnails = async (itemList: any[]) => {
    thumbnailAbortRef.current = false;
    const videoIds = itemList.map((item: any) => item.id);
    let totalDownloaded = 0;

    // Process in batches of 10
    for (let i = 0; i < videoIds.length; i += 10) {
      if (thumbnailAbortRef.current) break;

      const batch = videoIds.slice(i, i + 10);
      try {
        const result = await downloadThumbnailBatch(batch);
        totalDownloaded += result.downloaded;
        setThumbnailProgress({
          downloaded: totalDownloaded,
          remaining: result.remaining,
        });

        if (result.remaining === 0) break;
      } catch (err) {
        console.error('Thumbnail batch error:', err);
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    // Read the file to get item IDs for thumbnail downloading
    let parsedData: any = null;
    try {
      const text = await file.text();
      parsedData = JSON.parse(text);
    } catch {
      // Let the import mutation handle the error
    }

    importFile.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setFile(null);

        // Start progressive thumbnail download
        if (parsedData?.itemList && data.imported > 0) {
          downloadThumbnails(parsedData.itemList);
        }
      },
    });
  };

  const handleClose = () => {
    thumbnailAbortRef.current = true;
    setFile(null);
    setResult(null);
    setThumbnailProgress(null);
    importFile.reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Videos</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-indigo-400 bg-indigo-50'
                : file
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileJson size={32} className="text-green-500" />
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive
                    ? 'Drop your JSON file here'
                    : 'Drag & drop your TikTok data JSON'}
                </p>
                <p className="text-xs text-gray-400">
                  or click to browse files
                </p>
              </div>
            )}
          </div>

          {/* Import button */}
          {file && !result && (
            <button
              onClick={handleImport}
              disabled={importFile.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600
                text-white font-medium text-sm rounded-lg hover:bg-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importFile.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import File
                </>
              )}
            </button>
          )}

          {/* Error */}
          {importFile.isError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Import failed</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {(importFile.error as Error)?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Import complete</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-xs text-gray-500">Errors</p>
                </div>
              </div>

              {/* Thumbnail download progress */}
              {thumbnailProgress && thumbnailProgress.remaining > 0 && (
                <div className="flex items-center gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Image size={16} className="text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-blue-700">
                      Downloading thumbnails... {thumbnailProgress.downloaded} done, {thumbnailProgress.remaining} remaining
                    </p>
                  </div>
                  <Loader2 size={14} className="animate-spin text-blue-500" />
                </div>
              )}
              {thumbnailProgress && thumbnailProgress.remaining === 0 && (
                <div className="flex items-center gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    All {thumbnailProgress.downloaded} thumbnails downloaded
                  </p>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
                  <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                  rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
