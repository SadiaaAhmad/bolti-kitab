import 'package:flutter_test/flutter_test.dart';
import 'package:bolti_kitab_mobile/main.dart';

void main() {
  testWidgets('BoltiKitabApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const BoltiKitabApp());
    expect(find.byType(BoltiKitabApp), findsOneWidget);
  });
}
