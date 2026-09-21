import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const UOM_OPTIONS = ['Nos', 'Hours', 'Month', 'Year'];
const CATEGORIES = ['Software', 'SaaS', 'Website', 'Digital Product', 'Other'];
const BILLING_TYPES = ['One-time', 'Monthly', 'Yearly'];

const initialProduct = {
  item_type: 'Product',
  name: '',
  hsn_sac_code: '',
  uom: 'Nos',
  rate: '',
  gst_rate: 18,
  description: '',
  category: 'Software',
  billing_type: 'One-time',
  status: 'Active',
};

function TypePill({ selected, onClick, label, icon }) {
  const isSelected = selected === label;
  return (
    <TouchableOpacity
      onPress={() => onClick(label)}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: isSelected ? '#0284c7' : '#e2e8f0',
        backgroundColor: isSelected ? '#eff6ff' : '#fff',
      }}
    >
      {icon}
      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#0284c7' : '#64748b' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TogglePill({ selected, onClick, label }) {
  const isSelected = selected === label;
  return (
    <TouchableOpacity
      onPress={() => onClick(label)}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: isSelected ? '#0284c7' : '#e2e8f0',
        backgroundColor: isSelected ? '#eff6ff' : '#fff',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#0284c7' : '#64748b' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({ label, required, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{
          backgroundColor: '#fff',
          borderWidth: 1.5,
          borderColor: '#e2e8f0',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 10 : 12,
          fontSize: 14,
          color: '#0f172a',
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 80 : 46,
        }}
      />
    </View>
  );
}

function SelectField({ label, required, value, onChange, options }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
        </Text>
        <View style={{
          backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
          borderRadius: 12, paddingHorizontal: 12, height: 46, justifyContent: 'center'
        }}>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: value ? '#0f172a' : '#94a3b8', fontFamily: 'inherit' }}
          >
            <option value="" disabled>Select {label}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
      </Text>
      <View style={{
        backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
        borderRadius: 12, height: 46, justifyContent: 'center', overflow: 'hidden'
      }}>
        <Picker
          selectedValue={value}
          onValueChange={(val) => onChange(val)}
          style={{ height: 46, width: '100%', color: value ? '#0f172a' : '#94a3b8' }}
        >
          <Picker.Item label={`Select ${label}`} value="" color="#94a3b8" />
          {options.map((opt) => (
            <Picker.Item key={opt} label={String(opt)} value={opt} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export default function ProductScreen() {
  const router = useRouter();
  const [role, setRole] = useState('Field Executive');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [product, setProduct] = useState(initialProduct);

  const resetForm = () => {
    setProduct(initialProduct);
    setEditId(null);
  };

  const fetchProducts = useCallback(async () => {
    try {
      const params = {};
      if (filterType) params.item_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/products', { params });
      setProducts(res.data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType, filterStatus, search]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          if (u.role) setRole(u.role);
        }
      } catch (err) {
        console.error('Error reading stored user:', err);
      }
    };
    loadUser();
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleEdit = (p) => {
    setProduct({
      item_type: p.item_type || 'Product',
      name: p.name || '',
      hsn_sac_code: p.hsn_sac_code || '',
      uom: p.uom || 'Nos',
      rate: p.rate !== undefined ? String(p.rate) : '',
      gst_rate: p.gst_rate !== undefined ? p.gst_rate : 18,
      description: p.description || '',
      category: p.category || 'Software',
      billing_type: p.billing_type || 'One-time',
      status: p.status || 'Active',
    });
    setEditId(p._id);
    setShowForm(true);
  };

  const handleDelete = (p) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete "' + p.name + '"?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/products/' + p._id);
              Toast.show({ type: 'success', text1: 'Product deleted' });
              fetchProducts();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!product.name || !product.name.trim()) {
      Alert.alert('Missing Fields', 'Item Name is required.');
      return;
    }
    if (!product.item_type) {
      Alert.alert('Missing Fields', 'Item Type is required.');
      return;
    }
    if (product.rate === '' || product.rate === null || product.rate === undefined) {
      Alert.alert('Missing Fields', 'Rate is required.');
      return;
    }
    if (Number(product.rate) < 0) {
      Alert.alert('Invalid Input', 'Rate must be >= 0.');
      return;
    }
    if (product.gst_rate === '' || product.gst_rate === null || product.gst_rate === undefined) {
      Alert.alert('Missing Fields', 'GST Rate is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        item_type: product.item_type,
        name: product.name.trim(),
        hsn_sac_code: product.hsn_sac_code || '',
        uom: product.uom || 'Nos',
        rate: Number(product.rate) || 0,
        gst_rate: Number(product.gst_rate) || 0,
        description: product.description || '',
        category: product.category || '',
        billing_type: product.billing_type || 'One-time',
        status: product.status || 'Active',
      };

      if (editId) {
        await api.put('/products/' + editId, payload);
        Toast.show({ type: 'success', text1: 'Product updated successfully' });
      } else {
        await api.post('/products', payload);
        Toast.show({ type: 'success', text1: 'Product created successfully' });
      }
      resetForm();
      setShowForm(false);
      fetchProducts();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const isManagement = ['Admin', 'Project Manager', 'Team Lead', 'Managing Director MD'].includes(role);

  return (
    <AppLayout currentScreen="Product" role={role} scrollable={false}>
      <View style={{ flex: 1 }}>
        {/* Top Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push(isManagement ? '/AdminDashboard' : '/Dashboard')}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0f172a' }}>Products & Services</Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>Manage items catalog & billing rates</Text>
            </View>
          </View>
          {!showForm && (
            <TouchableOpacity
              onPress={() => { resetForm(); setShowForm(true); }}
              style={{ backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>

        {showForm ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 }}>
                {editId ? 'Edit Product / Service' : 'Add New Product / Service'}
              </Text>

              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Item Type <Text style={{ color: '#e11d48' }}>*</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TypePill
                    selected={product.item_type}
                    onClick={(val) => setProduct({ ...product, item_type: val })}
                    label="Product"
                    icon={<Ionicons name="cube-outline" size={16} color={product.item_type === 'Product' ? '#0284c7' : '#64748b'} />}
                  />
                  <TypePill
                    selected={product.item_type}
                    onClick={(val) => setProduct({ ...product, item_type: val })}
                    label="Service"
                    icon={<Ionicons name="construct-outline" size={16} color={product.item_type === 'Service' ? '#0284c7' : '#64748b'} />}
                  />
                </View>
              </View>

              <Field
                label="Item Name"
                required
                value={product.name}
                onChangeText={(text) => setProduct({ ...product, name: text })}
                placeholder="E.g. Website Development or CRM License"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={product.item_type === 'Product' ? 'HSN Code' : 'SAC Code'}
                    value={product.hsn_sac_code}
                    onChangeText={(text) => setProduct({ ...product, hsn_sac_code: text })}
                    placeholder={product.item_type === 'Product' ? 'E.g. 8523' : 'E.g. 9983'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="UOM"
                    value={product.uom}
                    onChange={(val) => setProduct({ ...product, uom: val })}
                    options={UOM_OPTIONS}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Rate (₹)"
                    required
                    value={product.rate?.toString()}
                    onChangeText={(text) => setProduct({ ...product, rate: text })}
                    keyboardType="numeric"
                    placeholder="E.g. 50000"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="GST Rate (%)"
                    required
                    value={product.gst_rate?.toString()}
                    onChangeText={(text) => setProduct({ ...product, gst_rate: text })}
                    keyboardType="numeric"
                    placeholder="E.g. 18"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Category"
                    value={product.category}
                    onChange={(val) => setProduct({ ...product, category: val })}
                    options={CATEGORIES}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Billing Type"
                    value={product.billing_type}
                    onChange={(val) => setProduct({ ...product, billing_type: val })}
                    options={BILLING_TYPES}
                  />
                </View>
              </View>

              <Field
                label="Description"
                value={product.description}
                onChangeText={(text) => setProduct({ ...product, description: text })}
                placeholder="Details shown under product name on quote / invoice PDF..."
                multiline
              />

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Status
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TogglePill
                    selected={product.status}
                    onClick={(val) => setProduct({ ...product, status: val })}
                    label="Active"
                  />
                  <TogglePill
                    selected={product.status}
                    onClick={(val) => setProduct({ ...product, status: val })}
                    label="Inactive"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                <TouchableOpacity
                  onPress={() => { setShowForm(false); resetForm(); }}
                  style={{ borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 14, color: '#64748b' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={{ backgroundColor: submitting ? '#94a3b8' : '#0f172a', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {submitting ? 'Saving...' : editId ? 'Save Changes' : 'Save Item'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0f172a" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Search & Filters */}
            <View style={{ marginBottom: 16, gap: 10 }}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search products by name, HSN, or category..."
                  placeholderTextColor="#94a3b8"
                  style={{
                    backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#e2e8f0',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    fontSize: 14,
                    color: '#0f172a',
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, height: 46, justifyContent: 'center' }}>
                  {Platform.OS === 'web' ? (
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', paddingLeft: 10, fontSize: 13, color: filterType ? '#0f172a' : '#64748b', outline: 'none' }}
                    >
                      <option value="">All Types</option>
                      <option value="Product">Product</option>
                      <option value="Service">Service</option>
                    </select>
                  ) : (
                    <Picker
                      selectedValue={filterType}
                      onValueChange={setFilterType}
                      style={{ height: 46 }}
                    >
                      <Picker.Item label="All Types" value="" color="#64748b" />
                      <Picker.Item label="Product" value="Product" />
                      <Picker.Item label="Service" value="Service" />
                    </Picker>
                  )}
                </View>

                <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, height: 46, justifyContent: 'center' }}>
                  {Platform.OS === 'web' ? (
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', paddingLeft: 10, fontSize: 13, color: filterStatus ? '#0f172a' : '#64748b', outline: 'none' }}
                    >
                      <option value="">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  ) : (
                    <Picker
                      selectedValue={filterStatus}
                      onValueChange={setFilterStatus}
                      style={{ height: 46 }}
                    >
                      <Picker.Item label="All Status" value="" color="#64748b" />
                      <Picker.Item label="Active" value="Active" />
                      <Picker.Item label="Inactive" value="Inactive" />
                    </Picker>
                  )}
                </View>
              </View>
            </View>

            {/* List of Products */}
            {products.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Ionicons name="cube-outline" size={48} color="#94a3b8" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#475569' }}>No products or services found</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Tap "Add Item" to add to your catalog</Text>
              </View>
            ) : (
              products.map((p) => (
                <View key={p._id} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{p.name}</Text>
                        <View style={{ backgroundColor: p.item_type === 'Product' ? '#e0f2fe' : '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, color: p.item_type === 'Product' ? '#0369a1' : '#15803d', fontWeight: '600' }}>{p.item_type}</Text>
                        </View>
                        <View style={{ backgroundColor: p.status === 'Active' ? '#f0fdf4' : '#f8fafc', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: p.status === 'Active' ? '#bbf7d0' : '#e2e8f0' }}>
                          <Text style={{ fontSize: 11, color: p.status === 'Active' ? '#16a34a' : '#64748b', fontWeight: '600' }}>{p.status}</Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                        {p.item_type === 'Product' ? 'HSN' : 'SAC'}: {p.hsn_sac_code || '—'}  •  UOM: {p.uom || 'Nos'}  •  GST: {p.gst_rate}%
                      </Text>

                      {p.category ? (
                        <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                          Category: {p.category} {p.billing_type ? `(${p.billing_type})` : ''}
                        </Text>
                      ) : null}

                      {p.description ? (
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={2}>{p.description}</Text>
                      ) : null}

                      <Text style={{ fontSize: 16, color: '#0284c7', fontWeight: '700', marginTop: 6 }}>
                        ₹{Number(p.rate || 0).toLocaleString('en-IN')} <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '400' }}>/ {p.uom || 'Nos'}</Text>
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => handleEdit(p)} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                        <Ionicons name="pencil" size={16} color="#334155" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(p)} style={{ padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 }}>
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}
