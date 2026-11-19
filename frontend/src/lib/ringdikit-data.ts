export interface BanjarStat {
  id: string;
  name: string;
  kelian: string;
  residents: number;
  households: number;
  percentage: number;
  accentHex: string;
  trackHex: string;
}

export interface LetterTemplateSpec {
  code: string;
  title: string;
  shortLabel: string;
  classification: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  mode:
    | "single_nik"
    | "birth_two_parents"
    | "death_report"
    | "name_diff_docs"
    | "heirs_multi_nik";
}

export interface DemoResident {
  id: string;
  nik: string;
  noKk: string;
  fullName: string;
  gender: "L" | "P";
  birthPlace: string;
  birthDate: string;
  religion: string;
  maritalStatus: string;
  shdk: string;
  education: string;
  occupation: string;
  banjar: string;
  address: string;
  status: "AKTIF" | "MENINGGAL" | "PINDAH_KELUAR";
  history: {
    date: string;
    type: string;
    summary: string;
    actor: string;
  }[];
}

export interface KadusSubmission {
  id: string;
  banjar: string;
  submittedBy: string;
  submittedAt: string;
  type: "KELAHIRAN" | "KEMATIAN" | "PERUBAHAN_KK" | "PINDAH_MASUK";
  residentName: string;
  nik: string;
  beforeSummary: string;
  afterSummary: string;
  evidenceDoc: string;
  status: "PENDING" | "APPROVED" | "REVISION";
}

export const RINGDIKIT_OVERVIEW = {
  slug: "ringdikit",
  customDomain: "ringdikit.desa.id",
  subdomain: "ringdikit.sideci.reisys.id",
  name: "Desa Ringdikit",
  district: "Kecamatan Seririt",
  regency: "Kabupaten Buleleng",
  province: "Provinsi Bali",
  postalCode: "81153",
  leaderTitle: "Perbekel Ringdikit",
  leaderName: "I Made Sumadi",
  hamletTerm: "Banjar Dinas",
  hamletLeaderTerm: "Kelian Banjar Dinas",
  officeAddress: "Jalan Raya Seririt – Pupuan, Desa Ringdikit 81153",
  officePhone: "+62 878 5875 5564",
  officeEmail: "desaringdikit@gmail.com",
  serviceHours: "Senin – Kamis 08.00–15.00 WITA • Jumat 08.00–12.00 WITA",
  welcomeQuote:
    "Pelayanan administrasi warga Desa Ringdikit kini terhubung langsung dari lima Banjar Dinas ke Sekretariat Desa secara tertib, transparan, dan mudah diakses masyarakat.",
  stats: {
    totalResidents: 5393,
    totalHouseholds: 1698,
    maleCount: 2656,
    femaleCount: 2737,
    unmappedLegacyRows: 83,
    eligibleVotersEstimate: 3980,
    birthCertRecorded: 1913,
    monthlyLettersIssued: 68,
    avgLetterSlaMinutes: 18,
  },
  banjars: [
    {
      id: "kajanan",
      name: "Banjar Dinas Kajanan",
      kelian: "Kelian BD. Kajanan",
      residents: 1778,
      households: 558,
      percentage: 33,
      accentHex: "#845EF7",
      trackHex: "#F2EFFE",
    },
    {
      id: "kelodan",
      name: "Banjar Dinas Kelodan",
      kelian: "Kelian BD. Kelodan",
      residents: 1717,
      households: 541,
      percentage: 32,
      accentHex: "#22B8CF",
      trackHex: "#E3FAFC",
    },
    {
      id: "sari-mekar",
      name: "Banjar Dinas Sari Mekar",
      kelian: "Kelian BD. Sari Mekar",
      residents: 751,
      households: 242,
      percentage: 14,
      accentHex: "#94D82D",
      trackHex: "#EEFCE3",
    },
    {
      id: "kuwum",
      name: "Banjar Dinas Kuwum",
      kelian: "Kelian BD. Kuwum",
      residents: 585,
      households: 194,
      percentage: 11,
      accentHex: "#FCC419",
      trackHex: "#FFF8DB",
    },
    {
      id: "rawa",
      name: "Banjar Dinas Rawa",
      kelian: "Kelian BD. Rawa",
      residents: 479,
      households: 163,
      percentage: 9,
      accentHex: "#FF6B5B",
      trackHex: "#FFE5E2",
    },
  ] satisfies BanjarStat[],
  educationStats: [
    { short: "Belum Skl", label: "Tidak / Belum Sekolah", count: 1643 },
    { short: "Blm SD", label: "Tidak Tamat SD", count: 424 },
    { short: "SD", label: "Tamat SD / Sederajat", count: 1700, highlight: true },
    { short: "SLTP", label: "SLTP / Sederajat", count: 664 },
    { short: "SLTA", label: "SLTA / Sederajat", count: 812 },
    { short: "D1–S2", label: "Diploma / Sarjana", count: 150 },
  ],
  maritalSegments: [
    { label: "Kawin", value: 2751, color: "#845EF7" },
    { label: "Belum Kawin", value: 2329, color: "#22B8CF" },
    { label: "Cerai Mati", value: 246, color: "#FCC419" },
    { label: "Cerai Hidup", value: 67, color: "#94D82D" },
  ],
  monthlyServiceSeries: [42, 48, 45, 54, 51, 60, 58, 63, 61, 68],
};

export const LETTER_TEMPLATES: LetterTemplateSpec[] = [
  {
    code: "SK_UMUM",
    title: "Surat Keterangan Umum / Pengantar",
    shortLabel: "Keterangan Umum",
    classification: "147",
    badgeColor: "#6741D9",
    badgeBg: "#F2EFFE",
    description:
      "Untuk Pengantar SKCK/Kepolisian, Domisili, Bebas Narkoba, Keterangan Usaha, atau Administrasi Umum (1 NIK Pemohon).",
    mode: "single_nik",
  },
  {
    code: "SK_KELAHIRAN",
    title: "Surat Keterangan Kelahiran",
    shortLabel: "Kelahiran",
    classification: "474.1",
    badgeColor: "#0CA678",
    badgeBg: "#E6FCF5",
    description:
      "Mencatat kelahiran anak lengkap dengan data Penolong Kelahiran serta tarik otomatis 2 NIK Orang Tua (Ibu & Ayah).",
    mode: "birth_two_parents",
  },
  {
    code: "SK_KEMATIAN",
    title: "Surat Keterangan Kematian",
    shortLabel: "Kematian",
    classification: "474.3",
    badgeColor: "#E8590C",
    badgeBg: "#FFE8CC",
    description:
      "Berdasarkan laporan kerabat atas NIK warga wafat; terhubung ke mutasi status penduduk MENINGGAL.",
    mode: "death_report",
  },
  {
    code: "SK_BEDA_NAMA",
    title: "Surat Keterangan Beda Nama",
    shortLabel: "Beda Nama",
    classification: "470",
    badgeColor: "#D97706",
    badgeBg: "#FFF8DB",
    description:
      "Menerangkan perbedaan penulisan nama satu orang yang sama pada beberapa dokumen (KTP, KK, Ijazah, Akta).",
    mode: "name_diff_docs",
  },
  {
    code: "SK_WARIS",
    title: "Surat Keterangan Ahli Waris",
    shortLabel: "Ahli Waris",
    classification: "470",
    badgeColor: "#1098AD",
    badgeBg: "#E3FAFC",
    description:
      "Memuat daftar dinamis Multi-NIK para ahli waris yang sah beserta data pewaris yang telah meninggal dunia.",
    mode: "heirs_multi_nik",
  },
];

export const DEMO_RESIDENTS: DemoResident[] = [
  {
    id: "res-01",
    nik: "5108020101900001",
    noKk: "5108021005150001",
    fullName: "I Putu Pratama Wijaya",
    gender: "L",
    birthPlace: "Ringdikit",
    birthDate: "1990-01-01",
    religion: "Hindu",
    maritalStatus: "Kawin",
    shdk: "Kepala Keluarga",
    education: "SLTA / Sederajat",
    occupation: "Wiraswasta",
    banjar: "Banjar Dinas Kelodan",
    address: "BD. Kelodan, Desa Ringdikit, Kode Pos 81153",
    status: "AKTIF",
    history: [
      {
        date: "2020-04-12",
        type: "Terdaftar Awal",
        summary: "Impor baseline SIAK Desa Ringdikit (KK 5108021005150001)",
        actor: "Operator Kependudukan",
      },
      {
        date: "2023-08-19",
        type: "Perkawinan & KK Baru",
        summary: "Perubahan status Belum Kawin menjadi Kawin & penetapan Kepala Keluarga",
        actor: "Diusulkan Kelian BD. Kelodan • Disetujui Operator Desa",
      },
      {
        date: "2026-10-04",
        type: "Surat Diterbitkan",
        summary: "Surat Keterangan Usaha (147/038/X/2026) — Terverifikasi QR",
        actor: "Operator Persuratan",
      },
    ],
  },
  {
    id: "res-02",
    nik: "5108025405930002",
    noKk: "5108021005150001",
    fullName: "Ni Kadek Ayu Lestari",
    gender: "P",
    birthPlace: "Seririt",
    birthDate: "1993-05-14",
    religion: "Hindu",
    maritalStatus: "Kawin",
    shdk: "Istri",
    education: "Diploma IV / Strata I",
    occupation: "Karyawan Swasta",
    banjar: "Banjar Dinas Kelodan",
    address: "BD. Kelodan, Desa Ringdikit, Kode Pos 81153",
    status: "AKTIF",
    history: [
      {
        date: "2023-08-19",
        type: "Pindah Datang & Kawin",
        summary: "Tercatat masuk ke KK 5108021005150001 di Banjar Dinas Kelodan",
        actor: "Diusulkan Kelian BD. Kelodan • Disetujui Operator Desa",
      },
    ],
  },
  {
    id: "res-03",
    nik: "5108021507620003",
    noKk: "5108020402090008",
    fullName: "I Nyoman Sutama",
    gender: "L",
    birthPlace: "Ringdikit",
    birthDate: "1962-07-15",
    religion: "Hindu",
    maritalStatus: "Kawin",
    shdk: "Kepala Keluarga",
    education: "Tamat SD / Sederajat",
    occupation: "Petani / Pekebun",
    banjar: "Banjar Dinas Kajanan",
    address: "BD. Kajanan, Desa Ringdikit, Kode Pos 81153",
    status: "AKTIF",
    history: [
      {
        date: "2019-09-10",
        type: "Terdaftar Awal",
        summary: "Pendataan awal penduduk Banjar Dinas Kajanan",
        actor: "Operator Kependudukan",
      },
    ],
  },
];

export const INITIAL_SUBMISSIONS: KadusSubmission[] = [
  {
    id: "SUB-RDK-01",
    banjar: "Banjar Dinas Kelodan",
    submittedBy: "Kelian BD. Kelodan",
    submittedAt: "19 Nov 2026 • 09:15 WITA",
    type: "KELAHIRAN",
    residentName: "Putu Saka Danendra (Bayi Baru)",
    nik: "Menunggu Akta / KK Baru",
    beforeSummary:
      "Anggota KK 5108021005150001 berjumlah 2 jiwa (I Putu Pratama Wijaya & Ni Kadek Ayu Lestari)",
    afterSummary:
      "Tambah Anak ke-1 (Laki-laki, lahir 17 Nov 2026 di RSUD Buleleng, Penolong: Bidan Luh Sari)",
    evidenceDoc: "Surat_Keterangan_Lahir_Bidan.jpg",
    status: "PENDING",
  },
  {
    id: "SUB-RDK-02",
    banjar: "Banjar Dinas Kajanan",
    submittedBy: "Kelian BD. Kajanan",
    submittedAt: "18 Nov 2026 • 16:40 WITA",
    type: "PERUBAHAN_KK",
    residentName: "Komang Adi Saputra",
    nik: "5108021208990004",
    beforeSummary: "Pendidikan: SLTA / Sederajat • Pekerjaan: Pelajar / Mahasiswa",
    afterSummary: "Pendidikan: Diploma IV / Strata I • Pekerjaan: Guru Honorer",
    evidenceDoc: "Scan_Ijazah_S1_dan_KK.pdf",
    status: "PENDING",
  },
];

export const MULTI_VILLAGE_TENANTS = [
  {
    slug: "ringdikit",
    name: "Desa Ringdikit",
    district: "Kec. Seririt, Kab. Buleleng",
    leaderTitle: "Perbekel",
    leaderName: "I Made Sumadi",
    subdomain: "ringdikit.sideci.reisys.id",
    customDomain: "ringdikit.desa.id",
    residents: 5393,
    dusuns: 5,
    status: "Aktif (Pilot)",
  },
  {
    slug: "ularan",
    name: "Desa Ularan",
    district: "Kec. Seririt, Kab. Buleleng",
    leaderTitle: "Perbekel",
    leaderName: "Perbekel Desa Ularan",
    subdomain: "ularan.sideci.reisys.id",
    customDomain: "—",
    residents: 3120,
    dusuns: 4,
    status: "Siap Onboarding",
  },
  {
    slug: "sulanyah",
    name: "Desa Sulanyah",
    district: "Kec. Seririt, Kab. Buleleng",
    leaderTitle: "Perbekel",
    leaderName: "Perbekel Desa Sulanyah",
    subdomain: "sulanyah.sideci.reisys.id",
    customDomain: "sulanyah.desa.id",
    residents: 2845,
    dusuns: 3,
    status: "Siap Onboarding",
  },
];

export function maskCitizenName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 1 ? "*" : part[0] + "*".repeat(part.length - 1)
    )
    .join(" ");
}
