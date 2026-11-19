package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/rey1024/sideci/backend/internal/auth"
	"github.com/rey1024/sideci/backend/internal/config"
	"github.com/rey1024/sideci/backend/internal/importer"
	"github.com/rey1024/sideci/backend/internal/store"
)

func main() {
	xlsxPath := flag.String("xlsx", "", "Path opsional ke file .xlsx SIAK untuk diimpor ke desa pilot")
	villageSlug := flag.String("village", "ringdikit", "Slug desa target")
	flag.Parse()

	cfg := config.Load()
	ctx := context.Background()

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("koneksi database gagal: %v", err)
	}
	defer st.Close()

	v, err := st.VillageBySlug(ctx, *villageSlug)
	if err != nil {
		log.Fatalf("desa '%s' belum ditemukan (pastikan migrasi telah berjalan): %v", *villageSlug, err)
	}

	var operatorID string
	seedPass := strings.TrimSpace(os.Getenv("SEED_INITIAL_PASSWORD"))
	if seedPass != "" {
		if len(seedPass) < 8 {
			log.Fatalf("SEED_INITIAL_PASSWORD minimal 8 karakter")
		}
		hash, err := auth.HashPassword(seedPass)
		if err != nil {
			log.Fatalf("hash password gagal: %v", err)
		}

		dusuns, err := st.ListDusuns(ctx, v.ID)
		if err != nil {
			log.Fatalf("gagal membaca dusun: %v", err)
		}
		dusunByName := make(map[string]string, len(dusuns))
		for _, d := range dusuns {
			dusunByName[strings.ToLower(strings.TrimSpace(d.Name))] = d.ID
		}

		accounts := []struct {
			username  string
			fullName  string
			villageID string
			dusunID   string
			roles     []string
		}{
			{"superadmin", "Superadmin Platform SIDECI", "", "", []string{"superadmin"}},
			{"perbekel_ringdikit", "I Made Sumadi (Perbekel Ringdikit)", v.ID, "", []string{"kepala_desa"}},
			{"op_ringdikit", "Operator Pelayanan Desa Ringdikit", v.ID, "", []string{"admin_desa", "operator_kependudukan", "operator_persuratan"}},
			{"op_ringdikit_kajanan", "Kelian Banjar Dinas Kajanan", v.ID, dusunByName["kajanan"], []string{"kepala_dusun"}},
			{"op_ringdikit_kelodan", "Kelian Banjar Dinas Kelodan", v.ID, dusunByName["kelodan"], []string{"kepala_dusun"}},
			{"op_ringdikit_kuwum", "Kelian Banjar Dinas Kuwum", v.ID, dusunByName["kuwum"], []string{"kepala_dusun"}},
			{"op_ringdikit_rawa", "Kelian Banjar Dinas Rawa", v.ID, dusunByName["rawa"], []string{"kepala_dusun"}},
			{"op_ringdikit_sari_mekar", "Kelian Banjar Dinas Sari Mekar", v.ID, dusunByName["sari mekar"], []string{"kepala_dusun"}},
			// Alias pendek tambahan
			{"perbekel", "I Made Sumadi", v.ID, "", []string{"kepala_desa"}},
			{"operator", "Operator Pelayanan Desa Ringdikit", v.ID, "", []string{"admin_desa", "operator_kependudukan", "operator_persuratan"}},
			{"kelodan", "Kelian Banjar Dinas Kelodan", v.ID, dusunByName["kelodan"], []string{"kepala_dusun"}},
		}

		for _, acc := range accounts {
			existing, err := st.UserByUsername(ctx, acc.username)
			if err == nil && existing != nil {
				_, _ = st.Pool.Exec(ctx,
					`UPDATE users SET password_hash=$1, full_name=$2, dusun_id=NULLIF($3,'')::uuid, is_active=TRUE, updated_at=NOW() WHERE id=$4::uuid`,
					hash, acc.fullName, acc.dusunID, existing.ID)
				if acc.username == "op_ringdikit" || (operatorID == "" && acc.username == "operator") {
					operatorID = existing.ID
				}
				fmt.Printf("[SEED] akun '%s' diperbarui\n", acc.username)
				continue
			}
			uid, err := st.CreateUser(ctx, acc.villageID, acc.dusunID, acc.username, acc.fullName, hash, acc.roles)
			if err != nil {
				log.Fatalf("gagal membuat akun '%s': %v", acc.username, err)
			}
			if acc.username == "op_ringdikit" || (operatorID == "" && acc.username == "operator") {
				operatorID = uid
			}
			fmt.Printf("[SEED] akun '%s' berhasil dibuat\n", acc.username)
		}
	}

	if *xlsxPath != "" {
		raw, err := os.ReadFile(*xlsxPath)
		if err != nil {
			log.Fatalf("gagal membaca file xlsx: %v", err)
		}
		dusuns, _ := st.ListDusuns(ctx, v.ID)
		known := make([]string, 0, len(dusuns))
		for _, d := range dusuns {
			known = append(known, d.Name)
		}
		report, err := importer.ParseSIAKXLSX(raw, known)
		if err != nil {
			log.Fatalf("gagal mem-parsing xlsx: %v", err)
		}
		n, err := st.ImportSIAKResidents(ctx, v.ID, operatorID, report.Residents)
		if err != nil {
			log.Fatalf("gagal mengimpor penduduk ke database: %v", err)
		}
		fmt.Printf("[IMPORT] selesai: imported=%d valid=%d kk=%d auto_healed=%d\n",
			n, report.ValidRows, report.UniqueHouseholds, report.AutoHealedDusunCount)
	}
}
