class MockFirestore {
  private data: Record<string, any> = {};
  setMockData(path: string, data: any) { this.data[path] = data; }
}
const db = new MockFirestore();
db.setMockData('organizations/org1', { id: 'org1', subscriptionPlan: 'pro' });
console.log((db as any).data['organizations/org1']);
