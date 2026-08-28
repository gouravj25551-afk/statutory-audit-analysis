"use client";

// ---------------------------------------------------------------------------
// Global client store. Holds the uploaded voucher/policy documents and the
// derived analysis. Everything lives in the browser (memory + localStorage);
// no document is ever uploaded to any server.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { analyseVoucher } from "./engine";
import { fileToText, newId, parsePolicy, parseVoucher } from "./extract";
import { PolicyDoc, VoucherAnalysis, VoucherDoc } from "./types";

interface StoreValue {
  vouchers: VoucherDoc[];
  policies: PolicyDoc[];
  analyses: Record<string, VoucherAnalysis>;
  ready: boolean;
  addVoucherFiles: (files: FileList | File[]) => Promise<void>;
  addPolicyFiles: (files: FileList | File[]) => Promise<void>;
  removeVoucher: (id: string) => void;
  removePolicy: (id: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<StoreValue | null>(null);
const LS_KEY = "sa_audit_state_v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [vouchers, setVouchers] = useState<VoucherDoc[]>([]);
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [ready, setReady] = useState(false);

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setVouchers(data.vouchers || []);
        setPolicies(data.policies || []);
      }
    } catch {
      /* ignore corrupt / unavailable storage */
    }
    setReady(true);
  }, []);

  // persist
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ vouchers, policies }));
    } catch {
      /* storage may be full or unavailable */
    }
  }, [vouchers, policies, ready]);

  const addVoucherFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const id = newId("v");
      const pending: VoucherDoc = {
        id,
        fileName: file.name,
        status: "processing",
        text: "",
        lines: [],
        fields: { supportingDocs: [] },
        fieldEvidence: {},
      };
      setVouchers((prev) => [...prev, pending]);
      try {
        const text = await fileToText(file);
        if (!text.trim()) throw new Error("No extractable text found in this file.");
        const parsed = parseVoucher(id, file.name, text);
        setVouchers((prev) => prev.map((v) => (v.id === id ? parsed : v)));
      } catch (e: any) {
        setVouchers((prev) =>
          prev.map((v) =>
            v.id === id ? { ...v, status: "failed", error: e?.message || "Extraction failed" } : v
          )
        );
      }
    }
  }, []);

  const addPolicyFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const id = newId("p");
      const pending: PolicyDoc = {
        id,
        name: file.name,
        fileName: file.name,
        status: "processing",
        text: "",
        lines: [],
        keywords: [],
        requirements: [],
      };
      setPolicies((prev) => [...prev, pending]);
      try {
        const text = await fileToText(file);
        if (!text.trim()) throw new Error("No extractable text found in this file.");
        const parsed = parsePolicy(id, file.name, text, file.name.replace(/\.[^.]+$/, ""));
        setPolicies((prev) => prev.map((p) => (p.id === id ? parsed : p)));
      } catch (e: any) {
        setPolicies((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "failed", error: e?.message || "Extraction failed" } : p
          )
        );
      }
    }
  }, []);

  const removeVoucher = useCallback((id: string) => {
    setVouchers((prev) => prev.filter((v) => v.id !== id));
  }, []);
  const removePolicy = useCallback((id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const clearAll = useCallback(() => {
    setVouchers([]);
    setPolicies([]);
  }, []);

  // Derive the analysis whenever inputs change. Only extracted docs count.
  const analyses = useMemo(() => {
    const okPolicies = policies.filter((p) => p.status === "extracted");
    const out: Record<string, VoucherAnalysis> = {};
    for (const v of vouchers) {
      if (v.status === "extracted") out[v.id] = analyseVoucher(v, okPolicies);
    }
    return out;
  }, [vouchers, policies]);

  const value: StoreValue = {
    vouchers,
    policies,
    analyses,
    ready,
    addVoucherFiles,
    addPolicyFiles,
    removeVoucher,
    removePolicy,
    clearAll,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
