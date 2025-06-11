import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CForm,
  CFormInput,
  CFormLabel,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    createdAt: '',
    lastLoginAt: '',
  });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await AuthService.getProfile();
      setProfile(data);
      setFormData({
        username: data.username,
        email: data.email,
        currentPassword: '',
        newPassword: '',
      });
    } catch (err) {
      setError('Erreur lors du chargement du profil');
      if (err.message === 'Token invalide') {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // On ne garde que les champs modifiés
      const updateData = {};
      if (formData.username !== profile.username) {
        updateData.username = formData.username;
      }
      if (formData.email !== profile.email) {
        updateData.email = formData.email;
      }
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        setSuccess('Aucune modification à sauvegarder');
        return;
      }

      await AuthService.updateProfile(updateData);
      setSuccess('Profil mis à jour avec succès');
      loadProfile(); // Recharger les données
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4">
            <CCardBody className="d-flex justify-content-center">
              <CSpinner />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    );
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Profil Utilisateur</strong>
          </CCardHeader>
          <CCardBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {success && <CAlert color="success">{success}</CAlert>}

            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>Nom d'utilisateur</CFormLabel>
                <CFormInput
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel>Email</CFormLabel>
                <CFormInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel>Date de création</CFormLabel>
                <CFormInput
                  type="text"
                  value={new Date(profile.createdAt).toLocaleString()}
                  disabled
                />
              </div>

              <div className="mb-3">
                <CFormLabel>Dernière connexion</CFormLabel>
                <CFormInput
                  type="text"
                  value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Jamais'}
                  disabled
                />
              </div>

              <hr />

              <h5>Changer le mot de passe</h5>
              <div className="mb-3">
                <CFormLabel>Mot de passe actuel</CFormLabel>
                <CFormInput
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                />
              </div>

              <div className="mb-3">
                <CFormLabel>Nouveau mot de passe</CFormLabel>
                <CFormInput
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                />
              </div>

              <div className="d-grid gap-2">
                <CButton
                  type="submit"
                  color="primary"
                  disabled={saving}
                >
                  {saving ? <CSpinner size="sm" /> : 'Sauvegarder les modifications'}
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default Profile; 