import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import ProductFormModal from '../components/ProductFormModal';

function SelectField({ label, required, value, onChange, options, optionKey = 'value', optionLabel = 'label' }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
        </Text>
        <View style={{
          backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
          borderRadius: 14, paddingHorizontal: 14, height: 50, justifyContent: 'center'
        }}>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: value ? '#0f172a' : '#94a3b8', fontFamily: 'inherit' }}
          >
            <option value="" disabled>Select {label}</option>
            {options.map(opt => (
              <option key={opt[optionKey] || opt} value={opt[optionKey] || opt}>{opt[optionLabel] || opt}</option>
            ))}
          </select>
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
      </Text>
      <View style={{
        backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
        borderRadius: 14, height: 50, justifyContent: 'center', overflow: 'hidden'
      }}>
        <Picker
          selectedValue={value}
          onValueChange={(val) => onChange(val)}
          style={{ height: 50, width: '100%', color: value ? '#0f172a' : '#94a3b8' }}
        >
          <Picker.Item label={`Select ${label}`} value="" color="#94a3b8" />
          {options.map(opt => <Picker.Item key={opt[optionKey] || opt} label={opt[optionLabel] || opt} value={opt[optionKey] || opt} />)}
        </Picker>
      </View>
    </View>
  );
}

function Field({ label, required, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: '#e11d48' }}> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        style={{
          backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 14, color: '#0f172a', minHeight: multiline ? 80 : 50,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function TypePill({ selected, onClick, label, icon }) {
  return (
    <TouchableOpacity
      onPress={() => onClick(label)}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        backgroundColor: selected === label ? '#eff6ff' : '#f8fafc',
        borderColor: selected === label ? '#0284c7' : '#e2e8f0',
      }}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: selected === label ? '700' : '500', color: selected === label ? '#0284c7' : '#64748b' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TogglePill({ selected, onClick, label }) {
  return (
    <TouchableOpacity
      onPress={() => onClick(label)}
      style={{
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        backgroundColor: selected === label ? '#eff6ff' : '#f8fafc',
        borderColor: selected === label ? '#0284c7' : '#e2e8f0',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: selected === label ? '700' : '500', color: selected === label ? '#0284c7' : '#64748b' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function Test() { return null; }