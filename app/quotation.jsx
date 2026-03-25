import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../constants/colors";
import {
  useClients,
  useDeleteQuotation,
  useProjects,
  useQuotations,
  useUpsertQuotation,
} from "../hooks/useSupabase";
import { formatCurrency, formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

const INPUT = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 11,
  fontSize: 15,
  color: "#1A1A2E",
};

// ─── Work types with standard rates ──────────────────────
const WORK_TYPES = [
  // ── Wall preparation ──
  {
    key: "white_cement",
    label: "⬜ White cement",
    unit: "sqft",
    icon: "⬜",
    defaultRate: 1.5,
    desc: "White cement finish",
  },
  {
    key: "putty_2coat",
    label: "🪣 Putty 2 coat",
    unit: "sqft",
    icon: "🪣",
    defaultRate: 6,
    desc: "2 coat wall putty",
  },
  {
    key: "putty_1coat",
    label: "🪣 Putty 1 coat",
    unit: "sqft",
    icon: "🪣",
    defaultRate: 3.5,
    desc: "1 coat wall putty",
  },
  {
    key: "primer",
    label: "🖌 Primer",
    unit: "sqft",
    icon: "🖌",
    defaultRate: 4,
    desc: "Wall primer coat",
  },
  // ── Interior painting ──
  {
    key: "interior_emulsion",
    label: "🏠 Interior emulsion",
    unit: "sqft",
    icon: "🏠",
    defaultRate: 12,
    desc: "2 coat interior emulsion",
  },
  {
    key: "interior_luxury",
    label: "🏠 Interior luxury paint",
    unit: "sqft",
    icon: "🏠",
    defaultRate: 18,
    desc: "Premium interior paint",
  },
  {
    key: "ceiling_paint",
    label: "⬆ Ceiling paint",
    unit: "sqft",
    icon: "⬆",
    defaultRate: 10,
    desc: "Ceiling white paint",
  },
  // ── Exterior painting ──
  {
    key: "exterior_emulsion",
    label: "🏗 Exterior emulsion",
    unit: "sqft",
    icon: "🏗",
    defaultRate: 14,
    desc: "2 coat exterior emulsion",
  },
  {
    key: "exterior_weather",
    label: "🏗 Weathershield",
    unit: "sqft",
    icon: "🏗",
    defaultRate: 22,
    desc: "Weathershield exterior",
  },
  // ── Special finishes ──
  {
    key: "texture_paint",
    label: "🌀 Texture paint",
    unit: "sqft",
    icon: "🌀",
    defaultRate: 25,
    desc: "Texture finish",
  },
  {
    key: "stencil",
    label: "🎨 Stencil design",
    unit: "sqft",
    icon: "🎨",
    defaultRate: 35,
    desc: "Stencil wall art",
  },
  {
    key: "wall_putty_polished",
    label: "✨ Putty + polish finish",
    unit: "sqft",
    icon: "✨",
    defaultRate: 20,
    desc: "Putty with polished finish",
  },
  // ── Wood & metal ──
  {
    key: "wood_polish",
    label: "🪵 Wood polish",
    unit: "sqft",
    icon: "🪵",
    defaultRate: 30,
    desc: "Wood polish finish",
  },
  {
    key: "wood_enamel",
    label: "🚪 Wood enamel paint",
    unit: "sqft",
    icon: "🚪",
    defaultRate: 20,
    desc: "Enamel on wood",
  },
  {
    key: "grill_paint",
    label: "🔩 Grill / MS paint",
    unit: "sqft",
    icon: "🔩",
    defaultRate: 15,
    desc: "Metal grill painting",
  },
  {
    key: "window_door",
    label: "🪟 Window / Door",
    unit: "nos",
    icon: "🪟",
    defaultRate: 350,
    desc: "Per window or door",
  },
  // ── Waterproofing ──
  {
    key: "waterproofing",
    label: "💧 Waterproofing",
    unit: "sqft",
    icon: "💧",
    defaultRate: 18,
    desc: "Waterproof coating",
  },
  {
    key: "terrace_waterproof",
    label: "🏛 Terrace waterproofing",
    unit: "sqft",
    icon: "🏛",
    defaultRate: 25,
    desc: "Terrace waterproof",
  },
  // ── Full package ──
  {
    key: "full_interior",
    label: "🏡 Full interior package",
    unit: "sqft",
    icon: "🏡",
    defaultRate: 28,
    desc: "Putty + primer + 2 coat paint",
  },
  {
    key: "full_exterior",
    label: "🏘 Full exterior package",
    unit: "sqft",
    icon: "🏘",
    defaultRate: 35,
    desc: "Primer + weathershield",
  },
  {
    key: "custom",
    label: "📝 Custom item",
    unit: "sqft",
    icon: "📝",
    defaultRate: 0,
    desc: "",
  },
];

const STATUS_CONFIG = {
  draft: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  sent: { bg: "#FAEEDA", text: "#633806", dot: "#F39C12" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#27AE60" },
  rejected: { bg: "#FCEBEB", text: "#791F1F", dot: "#E74C3C" },
};

function genQuotationNo() {
  const y = new Date().getFullYear();
  const r = Math.floor(1000 + Math.random() * 9000);
  return `QT-${y}-${r}`;
}

// ─── Quotation PDF Generator ──────────────────────────────
const buildQuotationHTML = (quotation, items, client, project) => {
  const subtotal = items.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 32px; color: #1A1A2E; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .brand  { font-size:26px; font-weight:900; color:#1E3A5F; }
  .brand-sub { font-size:11px; color:#6B7280; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
  .qt-label { text-align:right; }
  .qt-title { font-size:20px; font-weight:800; color:#1E3A5F; }
  .qt-no    { font-size:14px; font-weight:700; color:#1A1A2E; margin-top:2px; }
  .qt-date  { font-size:11px; color:#6B7280; margin-top:3px; }
  .divider  { height:3px; background:#1E3A5F; margin:0 0 18px; border-radius:2px; }
  .parties  { display:flex; justify-content:space-between; gap:16px; margin-bottom:20px; }
  .party    { flex:1; background:#F8FAFC; border-radius:10px; padding:12px 14px; }
  .party-lbl  { font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:5px; }
  .party-name { font-size:15px; font-weight:700; color:#1A1A2E; margin-bottom:3px; }
  .party-info { font-size:11px; color:#6B7280; line-height:1.7; }

  /* Main quotation table */
  table { width:100%; border-collapse:collapse; margin-bottom:18px; }
  thead tr { background:#1E3A5F; }
  th { color:#fff; padding:10px 10px; text-align:left; font-size:11px; font-weight:700; letter-spacing:0.3px; }
  td { padding:10px 10px; border-bottom:1px solid #F0F0F0; font-size:12px; vertical-align:middle; }
  tr:nth-child(even) td { background:#FAFBFC; }
  tr:last-child td { border-bottom:none; }

  /* Column alignments */
  .col-no     { width:5%;  text-align:center; }
  .col-work   { width:20%; font-weight:600; }
  .col-desc   { width:28%; color:#4B5563; }
  .col-area   { width:11%; text-align:right; }
  .col-rate   { width:12%; text-align:right; }
  .col-qty    { width:8%;  text-align:center; }
  .col-unit   { width:6%;  text-align:center; color:#6B7280; font-size:11px; }
  .col-amt    { width:14%; text-align:right; font-weight:700; color:#1E3A5F; }

  .work-tag   { display:inline-block; background:#EFF6FF; color:#1E40AF; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:600; }

  /* Totals */
  .total-wrap { display:flex; justify-content:flex-end; margin-bottom:18px; }
  .total-box  { width:260px; }
  .t-row      { display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #F0F0F0; font-size:12px; }
  .t-row.grand { background:#1E3A5F; color:#fff; font-size:15px; font-weight:800; border-radius:0 0 8px 8px; border:none; }

  .validity   { background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:9px 13px; font-size:12px; color:#92400E; margin-bottom:14px; }
  .notes-box  { background:#F5F6FA; border-radius:8px; padding:10px 12px; font-size:11px; color:#1A1A2E; margin-bottom:14px; line-height:1.7; }
  .terms-box  { font-size:11px; color:#6B7280; line-height:1.9; margin-bottom:18px; }
  .terms-box strong { color:#1A1A2E; }
  .sign-row   { display:flex; justify-content:space-between; margin-top:36px; }
  .sign-box   { text-align:center; width:42%; }
  .sign-line  { border-top:1px solid #1A1A2E; padding-top:6px; font-size:11px; color:#6B7280; }
  .footer     { text-align:center; font-size:10px; color:#9CA3AF; border-top:1px solid #E0E0E0; padding-top:12px; margin-top:18px; }
</style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand">🎨 PaintPro</div>
      <div class="brand-sub">Painting Contractor</div>
    </div>
    <div class="qt-label">
      <div class="qt-title">QUOTATION</div>
      <div class="qt-no">${quotation.quotation_no}</div>
      <div class="qt-date">Date: ${formatDate(quotation.quotation_date)}</div>
      ${quotation.valid_until ? `<div class="qt-date">Valid until: ${formatDate(quotation.valid_until)}</div>` : ""}
    </div>
  </div>
  <div class="divider"></div>

  <div class="parties">
    <div class="party">
      <div class="party-lbl">Prepared for</div>
      <div class="party-name">${client?.name ?? "Client"}</div>
      <div class="party-info">
        ${client?.phone ? `📞 ${client.phone}<br/>` : ""}
        ${client?.address ? `📍 ${client.address}` : ""}
      </div>
    </div>
    <div class="party">
      <div class="party-lbl">Project</div>
      <div class="party-name">${project?.title ?? "—"}</div>
      <div class="party-info">${project?.location ?? ""}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-no">#</th>
        <th class="col-work">Type of work</th>
        <th class="col-desc">Description</th>
        <th class="col-area">Area (sqft)</th>
        <th class="col-rate">Rate / sqft</th>
        <th class="col-qty">Qty</th>
        <th class="col-unit">Unit</th>
        <th class="col-amt">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map((item, idx) => {
          const wt = WORK_TYPES.find((w) => w.key === item.work_type);
          const total = Number(item.total_amount || 0);
          const isSqft = (item.unit ?? "sqft") === "sqft";
          return `
          <tr>
            <td class="col-no">${idx + 1}</td>
            <td class="col-work">
              <span class="work-tag">${wt?.icon ?? "📝"} ${wt?.label?.replace(/^[^\s]+\s/, "") ?? item.work_type}</span>
            </td>
            <td class="col-desc">${item.description ?? ""}</td>
            <td class="col-area">${isSqft ? Number(item.area_sqft ?? 0).toLocaleString("en-IN") : "—"}</td>
            <td class="col-rate">₹${Number(item.rate_per_sqft ?? 0).toLocaleString("en-IN")}</td>
            <td class="col-qty">${item.quantity ?? 1}</td>
            <td class="col-unit">${item.unit ?? "sqft"}</td>
            <td class="col-amt">₹${total.toLocaleString("en-IN")}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <div class="total-wrap">
    <div class="total-box">
      <div class="t-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
      <div class="t-row grand"><span>Grand Total</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
    </div>
  </div>

  ${quotation.valid_until ? `<div class="validity">⏰ This quotation is valid until <strong>${formatDate(quotation.valid_until)}</strong></div>` : ""}
  ${quotation.notes ? `<div class="notes-box"><strong>Notes:</strong> ${quotation.notes}</div>` : ""}
  ${quotation.terms ? `<div class="terms-box"><strong>Terms & Conditions:</strong><br/>${quotation.terms}</div>` : ""}

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line">Client signature & date</div></div>
    <div class="sign-box"><div class="sign-line">Contractor signature & date</div></div>
  </div>

  <div class="footer">PaintPro Business Tracker &nbsp;·&nbsp; Quotation ${quotation.quotation_no} &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-IN")}</div>
</body>
</html>`;
};

// ─── Quotation Card ───────────────────────────────────────
function QuotationCard({ qt, onPress, onShare, onDelete }) {
  const s = STATUS_CONFIG[qt.status] ?? STATUS_CONFIG.draft;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNo}>{qt.quotation_no}</Text>
          <Text style={styles.cardClient} numberOfLines={1}>
            👤 {qt.clients?.name ?? "No client"}
          </Text>
          <Text style={styles.cardProject} numberOfLines={1}>
            📋 {qt.projects?.title ?? "No project"}
          </Text>
          <Text style={styles.cardDate}>
            📅 {formatDate(qt.quotation_date)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
            <Text style={[styles.statusText, { color: s.text }]}>
              {qt.status.charAt(0).toUpperCase() + qt.status.slice(1)}
            </Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(qt)}>
            <Text style={styles.shareBtnText}>↗ Share PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(qt.id)}>
            <Text style={{ color: Colors.danger, fontSize: 13 }}>
              🗑 Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Quotation Modal ──────────────────────────────────────
function QuotationModal({ visible, onClose, quotation }) {
  const upsert = useUpsertQuotation();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const profile = useAuthStore((s) => s.profile);
  const isEdit = !!quotation?.id;

  const [quotationNo, setQuotationNo] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Payment: 50% advance, 50% on completion.",
  );
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuotationNo(quotation?.quotation_no ?? genQuotationNo());
      setQuotationDate(
        quotation?.quotation_date ?? new Date().toISOString().split("T")[0],
      );
      setValidUntil(quotation?.valid_until ?? "");
      setProjectId(quotation?.project_id ?? "");
      setClientId(quotation?.client_id ?? "");
      setStatus(quotation?.status ?? "draft");
      setNotes(quotation?.notes ?? "");
      setTerms(quotation?.terms ?? "Payment: 50% advance, 50% on completion.");
      setItems(
        quotation?.quotation_items?.length
          ? quotation.quotation_items.map((i) => ({
              work_type: i.work_type,
              description: i.description ?? "",
              area_sqft: i.area_sqft?.toString() ?? "0",
              rate_per_sqft: i.rate_per_sqft?.toString() ?? "0",
              quantity: i.quantity?.toString() ?? "1",
              unit: i.unit ?? "sqft",
            }))
          : [
              {
                work_type: "interior_wall",
                description: "",
                area_sqft: "",
                rate_per_sqft: "",
                quantity: "1",
                unit: "sqft",
              },
            ],
      );
      setProjectOpen(false);
      setClientOpen(false);
      setStatusOpen(false);
    }
  }, [visible, quotation]);

  // Auto-fill client when project selected
  useEffect(() => {
    if (projectId && !isEdit) {
      const proj = projects?.find((p) => p.id === projectId);
      if (proj?.client_id) setClientId(proj.client_id);
    }
  }, [projectId, projects]);

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        work_type: "interior_wall",
        description: "",
        area_sqft: "",
        rate_per_sqft: "",
        quantity: "1",
        unit: "sqft",
      },
    ]);

  const removeItem = (i) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) =>
    setItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [key]: val } : item)),
    );

  const grandTotal = items.reduce((s, item) => {
    const isSqft = (item.unit ?? "sqft") === "sqft";
    const t = isSqft
      ? (parseFloat(item.area_sqft) || 0) *
        (parseFloat(item.rate_per_sqft) || 0) *
        (parseFloat(item.quantity) || 1)
      : (parseFloat(item.rate_per_sqft) || 0) *
        (parseFloat(item.quantity) || 1);
    return s + t;
  }, 0);

  const selectedProject = projects?.find((p) => p.id === projectId);
  const selectedClient = clients?.find((c) => c.id === clientId);

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert("Required", "Please select a project");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Required", "Add at least one work item");
      return;
    }
    setSaving(true);
    try {
      await upsert.mutateAsync({
        quotation: {
          ...(isEdit ? { id: quotation.id } : {}),
          quotation_no: quotationNo,
          quotation_date: quotationDate,
          valid_until: validUntil || null,
          project_id: projectId,
          client_id: clientId || null,
          status,
          notes,
          terms,
          created_by: profile?.id,
        },
        items: items.map((item) => ({
          work_type: item.work_type,
          description: item.description || null,
          area_sqft: parseFloat(item.area_sqft) || 0,
          rate_per_sqft: parseFloat(item.rate_per_sqft) || 0,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit ?? "sqft",
        })),
      });
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEdit ? "Edit quotation" : "New quotation"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header fields */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quotation no.</Text>
              <TextInput
                style={INPUT}
                value={quotationNo}
                onChangeText={setQuotationNo}
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={INPUT}
                value={quotationDate}
                onChangeText={setQuotationDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Text style={styles.label}>Valid until</Text>
          <TextInput
            style={INPUT}
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            underlineColorAndroid="transparent"
          />

          {/* Project */}
          <Text style={styles.label}>Project *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setProjectOpen(!projectOpen);
              setClientOpen(false);
              setStatusOpen(false);
            }}
          >
            <Text
              style={
                selectedProject ? styles.pickerValue : styles.pickerPlaceholder
              }
            >
              {selectedProject?.title ?? "Select project"}
            </Text>
            <Text style={styles.pickerArrow}>{projectOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {projectOpen && (
            <View style={styles.dropdown}>
              {(projects ?? []).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.dropItem,
                    projectId === p.id && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setProjectId(p.id);
                    setProjectOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropText,
                      projectId === p.id && {
                        color: Colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {p.title}
                  </Text>
                  {p.location ? (
                    <Text style={styles.dropSub}>📍 {p.location}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Client */}
          <Text style={styles.label}>Client</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setClientOpen(!clientOpen);
              setProjectOpen(false);
              setStatusOpen(false);
            }}
          >
            <Text
              style={
                selectedClient ? styles.pickerValue : styles.pickerPlaceholder
              }
            >
              {selectedClient?.name ??
                "Select client (auto-filled from project)"}
            </Text>
            <Text style={styles.pickerArrow}>{clientOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {clientOpen && (
            <View style={styles.dropdown}>
              {(clients ?? []).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.dropItem,
                    clientId === c.id && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setClientId(c.id);
                    setClientOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropText,
                      clientId === c.id && {
                        color: Colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {c.name}
                  </Text>
                  {c.phone ? (
                    <Text style={styles.dropSub}>📞 {c.phone}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setStatusOpen(!statusOpen);
              setProjectOpen(false);
              setClientOpen(false);
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_CONFIG[status]?.dot },
                ]}
              />
              <Text style={styles.pickerValue}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
            <Text style={styles.pickerArrow}>{statusOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {statusOpen && (
            <View style={styles.dropdown}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dropItem,
                    status === key && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setStatus(key);
                    setStatusOpen(false);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: cfg.dot }]}
                    />
                    <Text
                      style={[
                        styles.dropText,
                        status === key && {
                          color: Colors.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Work items */}
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsTitle}>Work items</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Text style={styles.addItemText}>+ Add item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, i) => (
            <WorkItemRow
              key={i}
              item={item}
              index={i}
              onChange={(key, val) => updateItem(i, key, val)}
              onRemove={() => removeItem(i)}
            />
          ))}

          {/* Grand total */}
          {grandTotal > 0 && (
            <View style={styles.grandTotalBox}>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>
                  Total items: {items.length}
                </Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.grandTotalSub}>Grand Total Estimate</Text>
                  <Text style={styles.grandTotalValue}>
                    {formatCurrency(grandTotal)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Notes & Terms */}
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[INPUT, { height: 72, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes for client..."
            placeholderTextColor="#9CA3AF"
            multiline
            underlineColorAndroid="transparent"
          />

          <Text style={styles.label}>Terms & Conditions</Text>
          <TextInput
            style={[INPUT, { height: 88, textAlignVertical: "top" }]}
            value={terms}
            onChangeText={setTerms}
            multiline
            underlineColorAndroid="transparent"
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function QuotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId ?? null;
  const projectTitle = params.projectTitle ?? "All Projects";

  const [selProject, setSelProject] = useState(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(null);

  const { data: projects } = useProjects();
  const {
    data: quotations,
    isLoading,
    refetch,
    isRefetching,
  } = useQuotations(selProject);
  const deleteQt = useDeleteQuotation();

  const handleDelete = (id) => {
    Alert.alert("Delete", "Delete this quotation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteQt.mutate(id),
      },
    ]);
  };

  const handleShare = async (qt) => {
    setGenerating(qt.id);
    try {
      const { data: full } = await useQuotation(qt.id);
      const items = full?.quotation_items ?? [];
      const html = buildQuotationHTML(
        full,
        items,
        full?.clients,
        full?.projects,
      );
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Quotation ${qt.quotation_no}`,
      });
    } catch (e) {
      // Fallback: fetch separately
      try {
        const { supabase } = require("../lib/supabase");
        const { data: full } = await supabase
          .from("quotations")
          .select("*, clients(*), projects(*), quotation_items(*)")
          .eq("id", qt.id)
          .single();
        const html = buildQuotationHTML(
          full,
          full.quotation_items ?? [],
          full.clients,
          full.projects,
        );
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Quotation ${qt.quotation_no}`,
        });
      } catch (e2) {
        Alert.alert("Error", e2.message);
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quotations</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {projectTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSelected(null);
            setModalOpen(true);
          }}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {!projectId && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <TouchableOpacity
            style={[styles.chip, !selProject && styles.chipActive]}
            onPress={() => setSelProject(null)}
          >
            <Text
              style={[styles.chipText, !selProject && styles.chipTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>
          {(projects ?? []).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selProject === p.id && styles.chipActive]}
              onPress={() => setSelProject(p.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selProject === p.id && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !(quotations ?? []).length ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>📄</Text>
          <Text style={styles.emptyTitle}>No quotations yet</Text>
          <Text style={styles.emptyMsg}>
            Create professional quotations with sqft-based pricing
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setModalOpen(true)}
          >
            <Text style={styles.emptyBtnText}>Create first quotation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuotationCard
              qt={item}
              onPress={() => {
                setSelected(item);
                setModalOpen(true);
              }}
              onShare={handleShare}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 0,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setSelected(null);
          setModalOpen(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <QuotationModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        quotation={selected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
    gap: 10,
  },
  backBtn: { padding: 4 },
  backText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  cardNo: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 3,
  },
  cardClient: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  cardProject: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  cardDate: { fontSize: 11, color: Colors.textMuted },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  shareBtn: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  shareBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
  skeleton: {
    height: 110,
    backgroundColor: "#E0E0E0",
    borderRadius: 14,
    opacity: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  emptyMsg: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  modalClose: { padding: 4, width: 32 },
  closeText: { fontSize: 18, color: Colors.textSecondary },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalBody: { flex: 1, padding: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  picker: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { fontSize: 15, color: "#1A1A2E", flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: "#9CA3AF", flex: 1 },
  pickerArrow: { fontSize: 12, color: Colors.textMuted },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  dropItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  dropItemActive: { backgroundColor: "#EFF6FF" },
  dropText: { fontSize: 15, color: "#1A1A2E" },
  dropSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  ratePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  ratePickerText: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  rateChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minWidth: 120,
    alignItems: "center",
  },
  rateChipName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 3,
    textAlign: "center",
  },
  rateChipRate: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  itemsTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A2E" },
  addItemBtn: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },
  itemRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textMuted,
    width: 24,
  },
  itemTypePicker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemTypeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
  },
  removeBtn: { padding: 6 },
  removeBtnText: { fontSize: 16, color: Colors.danger },
  typeDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  typeDropItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  typeDropItemActive: { backgroundColor: "#EFF6FF" },
  typeDropText: { fontSize: 14, color: "#1A1A2E", flex: 1 },
  typeDropRate: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.success,
    marginBottom: 2,
  },
  typeDropUnit: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemFields: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  itemField: { minWidth: "45%", flex: 1 },
  itemFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 4,
  },
  itemFieldInput: { paddingVertical: 9 },
  itemTotal: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  grandTotalBox: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalLabel: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  grandTotalSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  grandTotalValue: { fontSize: 28, fontWeight: "900", color: "#fff" },
});
