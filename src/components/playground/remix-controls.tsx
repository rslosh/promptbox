"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Copy, Trash2, Check, Loader2 } from "lucide-react";

interface RemixControlsProps {
  remixId: string | null;
  remixName: string | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
  onClear: () => void;
  onNameChange: (name: string) => void;
}

export function RemixControls({
  remixId,
  remixName,
  isSaving,
  hasUnsavedChanges,
  onSave,
  onSaveAsNew,
  onClear,
  onNameChange,
}: RemixControlsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(remixName || "");

  const handleNameSubmit = () => {
    onNameChange(nameInput);
    setIsEditingName(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Remix name */}
      {isEditingName ? (
        <div className="flex items-center gap-1">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Remix name..."
            className="h-8 w-40 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={handleNameSubmit}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditingName(true)}
          className="text-sm text-secondary hover:text-primary"
        >
          {remixName || "Untitled remix"}
        </button>
      )}

      {/* Unsaved indicator */}
      {hasUnsavedChanges && !isSaving && (
        <span className="text-xs text-amber-600">Unsaved</span>
      )}

      {/* Save button */}
      {remixId && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Save as new button */}
      <Button size="sm" variant="ghost" onClick={onSaveAsNew} disabled={isSaving}>
        <Copy className="h-4 w-4" />
      </Button>

      {/* Clear button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="text-red-500 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
