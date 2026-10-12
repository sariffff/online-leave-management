/* eslint-disable react/no-unescaped-entities */
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// วางฟอนต์ไทยไว้ใน public/fonts/Sarabun-*.ttf
Font.register({
  family: "Sarabun",
  fonts: [
    { src: "/fonts/Sarabun-Regular.ttf" },
    { src: "/fonts/Sarabun-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Sarabun", fontSize: 12, lineHeight: 1.6 },
  title: { fontSize: 18, textAlign: "center", fontWeight: "bold", marginBottom: 18 },
  right: { textAlign: "right", marginBottom: 16 },
  row: { marginBottom: 6, flexDirection: "row" },
  label: { width: 60, fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  footer: { marginTop: 28, alignItems: "center" },
  signer: { marginTop: 18, textAlign: "center" },
  link: { color: "#1a5edb", textDecoration: "underline" },
});

export type LeavePdfData = {
  code: string;
  printedAtText: string;
  recipient: string;
  prename: string;
  name: string;
  surname: string;
  reason: string;
  dateStartText: string;
  dateEndText: string;
  totalDaysText: string;
  attachmentLabel?: string;
  attachmentUrl?: string;
  approverName: string;
  approverTitle: string;
  approvedDateText: string;
  comment?: string;
};

export default function LeavePdfDoc({ data }: { data: LeavePdfData }) {
  const d = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>ใบ(leaveType) รหัสใบลาที่ {d.code}</Text>
        <Text style={styles.right}>{d.printedAtText}</Text>

        <View style={styles.row}><Text style={styles.label}>เรียน</Text><Text>{d.recipient}</Text></View>
        <View style={styles.row}><Text style={styles.label}>ข้าพเจ้า</Text><Text>{d.prename} {d.name} {d.surname}</Text></View>

        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Text>
            ขอ (leaveType) ตั้งแต่วันที่ <Text style={styles.bold}>{d.dateStartText}</Text>{" "}
            ถึงวันที่ <Text style={styles.bold}>{d.dateEndText}</Text>{" "}
            เป็นเวลา <Text style={styles.bold}>{d.totalDaysText}</Text>
          </Text>
        </View>

        <View style={styles.row}><Text style={styles.label}>เนื่องจาก</Text><Text>{d.reason}</Text></View>

        {!!d.attachmentUrl && (
          <View style={[styles.row, { marginTop: 4 }]}>
            <Text style={styles.label}>ไฟล์แนบ</Text>
            <Link src={d.attachmentUrl} style={styles.link}>{d.attachmentLabel ?? d.attachmentUrl}</Link>
          </View>
        )}

        <View style={styles.footer}>
          <Text>อนุมัติ(stats)</Text>
          <View style={styles.signer}>
            <Text style={styles.bold}>{d.approverName}</Text>
            <Text>{d.approverTitle}</Text>
            <Text>{d.approvedDateText}</Text>
            <Text>ความคิดเห็น : {d.comment ?? "-"}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
