{{/*
Expand the name of the chart.
*/}}
{{- define "chesslink.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "chesslink.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "chesslink.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "chesslink.backend.labels" -}}
{{ include "chesslink.labels" . }}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-backend
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "chesslink.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "chesslink.frontend.labels" -}}
{{ include "chesslink.labels" . }}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-frontend
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "chesslink.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MongoDB labels
*/}}
{{- define "chesslink.mongodb.labels" -}}
{{ include "chesslink.labels" . }}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-mongodb
app.kubernetes.io/component: database
{{- end }}

{{/*
MongoDB selector labels
*/}}
{{- define "chesslink.mongodb.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chesslink.fullname" . }}-mongodb
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}