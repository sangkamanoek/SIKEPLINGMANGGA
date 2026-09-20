import sys
import json
import re

def process_line(line):
    # CSV format: NO,NOP,BUKU,Nama WP,Alamat OP, PBB,Status,LING.
    # Note that BUKU or Nama WP might be quoted e.g. "IV, V" or "L GINTING, BA"
    parts = []
    current = []
    in_quotes = False
    for char in line:
        if char == '"':
            in_quotes = not in_quotes
        elif char == ',' and not in_quotes:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        parts.append("".join(current).strip())
    return parts

def main():
    summary = {}
    for i in range(1, 25):
        summary[i] = {
            "targetNominal": 0,
            "realisasiNominal": 0,
            "totalWp": 0,
            "wpLunas": 0
        }

    sppt_items = []
    
    with open('/tmp/user_raw_pbb.csv', 'r', encoding='utf-8') as f:
        count = 0
        for line in f:
            line = line.strip()
            if not line or line.startswith('NO,NOP') or line.startswith(',,,') or 'DAFTAR OBJEK' in line or 'Tahun 2025' in line:
                continue
            
            parts = process_line(line)
            if len(parts) >= 8:
                try:
                    no_str = parts[0]
                    nop = parts[1]
                    buku = parts[2].replace('"', '')
                    nama_wp = parts[3].replace('"', '')
                    alamat_op = parts[4].replace('"', '')
                    pbb_str = re.sub(r'[^0-9]', '', parts[5])
                    status_str = parts[6]
                    ling_str = re.sub(r'[^0-9]', '', parts[7])

                    if not pbb_str or not ling_str:
                        continue

                    pbb_val = int(pbb_str)
                    ling_val = int(ling_str)
                    if ling_val < 1 or ling_val > 24:
                        continue

                    is_lunas = 'lunas' in status_str.lower() or 'sudah' in status_str.lower()

                    summary[ling_val]["totalWp"] += 1
                    summary[ling_val]["targetNominal"] += pbb_val

                    if is_lunas:
                        summary[ling_val]["wpLunas"] += 1
                        summary[ling_val]["realisasiNominal"] += pbb_val

                    count += 1
                    if len(sppt_items) < 300: # Store first 300 items for detail view
                        sppt_items.append({
                            "id": str(count),
                            "no": count,
                            "nop": nop,
                            "buku": buku,
                            "namaWp": nama_wp,
                            "alamatOp": alamat_op,
                            "pbbTerutang": pbb_val,
                            "status": "Sudah Bayar" if is_lunas else "Belum Bayar",
                            "lingkungan": ling_val
                        })
                except Exception as e:
                    pass

    with open('/src/data/computedSummary.json', 'w', encoding='utf-8') as out_f:
        json.dump({"summary": summary, "spptItems": sppt_items}, out_f, indent=2)

    print("DONE processing", count, "lines")

if __name__ == '__main__':
    main()
