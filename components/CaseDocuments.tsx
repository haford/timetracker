"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeCaseDocuments, uploadCaseDocument, deleteCaseDocument } from "@/lib/storage";
import type { CaseDocument } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

const ACCEPTED = ".pdf,.doc,.docx,.odt,.txt";
const MAX_MB = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  userId: string;
  caseId: string;
}

export function CaseDocuments({ userId, caseId }: Props) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleteDoc, setDeleteDoc] = useState<CaseDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeCaseDocuments(userId, caseId, setDocuments);
    return unsub;
  }, [userId, caseId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Filen er for stor (maks ${MAX_MB} MB)`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      await uploadCaseDocument(userId, caseId, file, setProgress);
      toast.success(`"${file.name}" lastet opp`);
    } catch (err) {
      console.error("[CaseDocuments] upload error:", err);
      toast.error("Opplasting feilet");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await deleteCaseDocument(userId, caseId, deleteDoc);
      toast.success("Dokument slettet");
    } catch {
      toast.error("Sletting feilet");
    } finally {
      setDeleting(false);
      setDeleteDoc(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dokumenter
            </CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {progress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1.5" />
                    Last opp
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {uploading && (
            <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {documents.length === 0 && !uploading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Ingen dokumenter lastet opp ennå
            </p>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-3">
                  <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(doc.size)} · {format(doc.uploadedAt, "d. MMM yyyy", { locale: nb })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.name}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Last ned">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      title="Slett"
                      onClick={() => setDeleteDoc(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteDoc?.name}&rdquo; vil bli slettet permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Sletter..." : "Slett"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
