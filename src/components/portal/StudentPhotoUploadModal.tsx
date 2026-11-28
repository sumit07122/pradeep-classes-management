import React, { useState } from "react";
import { Camera, Upload, AlertTriangle, ShieldCheck } from "lucide-react";
import { Modal, Button, AlertNotice } from "../common";
import { studentsService } from "../../services/studentsService";

interface StudentPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  admissionNo: string;
  onSuccess: (photoUrl: string) => void;
}

export const StudentPhotoUploadModal: React.FC<StudentPhotoUploadModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  admissionNo,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmAndLock = async () => {
    if (!selectedFile) {
      setError("Please select a passport photograph to upload.");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const res = await studentsService.uploadStudentPhotoAndLock(studentId, selectedFile);
      if (!res.success || !res.photo_url) {
        throw new Error(res.error || "Failed to upload photo and lock profile");
      }

      onSuccess(res.photo_url);
      onClose();
    } catch (err: any) {
      console.error("Error in handleConfirmAndLock:", err);
      setError(err.message || "Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Official Passport Photo">
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            Permanent Identity Lock Notice
          </div>
          <p className="leading-relaxed">
            Please select a clear, front-facing passport photograph. Once uploaded and confirmed, your
            <strong> photograph, registered full name, and mobile number will be permanently locked</strong> in the ERP system
            and cannot be edited or removed from your student account.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="w-28 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Passport Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-3 text-slate-400">
                <Camera size={28} className="mx-auto mb-1 text-slate-300" />
                <span className="text-[10px] font-bold block">No Photo</span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-left flex-1">
            <div>
              <div className="text-sm font-extrabold text-slate-900">{studentName}</div>
              <div className="text-xs text-slate-500 font-mono">Admission No: {admissionNo}</div>
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs transition">
              <Upload size={14} className="text-[#102f50]" />
              <span>Choose Image File...</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <p className="text-[11px] text-slate-400">JPG, PNG, or WebP up to 5MB.</p>
          </div>
        </div>

        {error && (
          <AlertNotice type="error" message={error} onDismiss={() => setError(null)} />
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmAndLock}
            isLoading={isUploading}
            disabled={!selectedFile}
            className="bg-[#102f50] hover:bg-[#16466f]"
          >
            <ShieldCheck size={14} className="mr-1.5 text-emerald-400" />
            Upload & Lock Identity
          </Button>
        </div>
      </div>
    </Modal>
  );
};
