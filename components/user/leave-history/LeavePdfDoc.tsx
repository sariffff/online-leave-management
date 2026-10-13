import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// ฟอนต์ไทยอยู่ที่ public/fonts/Sarabun-*.ttf
Font.register({
  family: "Sarabun",
  fonts: [{ src: "/fonts/Sarabun-Regular.ttf" }, { src: "/fonts/Sarabun-Bold.ttf", fontWeight: "bold" }],
});
Font.registerHyphenationCallback((word) => [word]); // ไม่ตัดคำกลางประโยคภาษาไทย

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Sarabun", fontSize: 13, lineHeight: 1.6 },
  title: { fontSize: 18, textAlign: "center", fontWeight: "bold", marginBottom: 18 },
  right: { textAlign: "right", marginBottom: 16 },
  row: { marginBottom: 6, flexDirection: "row" },
  label: { width: 70, fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  footer: { marginTop: 28, alignItems: "center" },
  signer: { marginTop: 18, textAlign: "center" },
});

export type LeavePdfData = {
  code: string;
  printedAtText: string;
  recipient: string;
  applicantName: string;
  leaveTypeName: string;
  reason: string;
  dateStartText: string;
  dateEndText: string;
  totalDaysText: string;
  attachmentCount: number;
  statusText: string;
  approverName?: string;
  approverTitle: string;
  approvedDateText?: string;
  comment?: string;
};

export default function LeavePdfDoc({ data: d }: { data: LeavePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          ใบ{d.leaveTypeName} รหัสใบลาที่ {d.code}
        </Text>
        <Text style={styles.right}>{d.printedAtText}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>เรียน</Text>
          <Text>{d.recipient}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ข้าพเจ้า</Text>
          <Text>{d.applicantName}</Text>
        </View>

        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Text>
            ขอ{d.leaveTypeName} ตั้งแต่วันที่ <Text style={styles.bold}>{d.dateStartText}</Text> ถึงวันที่{" "}
            <Text style={styles.bold}>{d.dateEndText}</Text> เป็นเวลา <Text style={styles.bold}>{d.totalDaysText}</Text>
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>เนื่องจาก</Text>
          <Text style={{ flex: 1 }}>{d.reason}</Text>
        </View>

        {d.attachmentCount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>เอกสารแนบ</Text>
            <Text>{d.attachmentCount} ไฟล์</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.bold}>ผลการพิจารณา: {d.statusText}</Text>
          {d.approverName ? (
            <View style={styles.signer}>
              <Text style={styles.bold}>{d.approverName}</Text>
              <Text>{d.approverTitle}</Text>
              {d.approvedDateText ? <Text>{d.approvedDateText}</Text> : null}
              <Text>ความคิดเห็น : {d.comment || "-"}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
