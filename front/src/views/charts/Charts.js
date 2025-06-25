import React from 'react'
import { CCard, CCardBody, CCol, CCardHeader, CRow } from '@coreui/react'
import {
  CChartBar,
  CChartDoughnut,
  CChartLine,
  CChartPie,
  CChartPolarArea,
  CChartRadar,
} from '@coreui/react-chartjs'
import { DocsLink } from 'src/components'

const Charts = () => {
  const random = () => Math.round(Math.random() * 100)

  return (
    <CRow>
      <CCol xs={12}></CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Bar Chart <DocsLink name="chart" />
          </CCardHeader>
          <CCardBody>
            <CChartBar
              data={{
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
                datasets: [
                  {
                    label: 'GitHub Commits',
                    backgroundColor: getComputedStyle(document.body).getPropertyValue('--color-danger').trim() || "#ef4444",
                    data: [40, 20, 12, 39, 10, 40, 39, 80, 40],
                  },
                ],
              }}
              labels="months"
            />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Line Chart <DocsLink name="chart" />
          </CCardHeader>
          <CCardBody>
            <CChartLine
              data={{
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
                datasets: [
                  {
                    label: 'My First dataset',
                    backgroundColor: 'rgba(220, 220, 220, 0.2)',
                    borderColor: 'rgba(220, 220, 220, 1)',
                    pointBackgroundColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointBorderColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    data: [random(), random(), random(), random(), random(), random(), random()],
                  },
                  {
                    label: 'My Second dataset',
                    backgroundColor: 'rgba(151, 187, 205, 0.2)',
                    borderColor: 'rgba(151, 187, 205, 1)',
                    pointBackgroundColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointBorderColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    data: [random(), random(), random(), random(), random(), random(), random()],
                  },
                ],
              }}
            />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Doughnut Chart <DocsLink name="chart" />
          </CCardHeader>
          <CCardBody>
            <CChartDoughnut
              data={{
                labels: ['VueJs', 'EmberJs', 'ReactJs', 'AngularJs'],
                datasets: [
                  {
                    backgroundColor: [
                      getComputedStyle(document.body).getPropertyValue('--color-success').trim() || "#10b981",
                      getComputedStyle(document.body).getPropertyValue('--color-danger').trim() || "#ef4444",
                      getComputedStyle(document.body).getPropertyValue('--color-info').trim() || "#06b6d4",
                      getComputedStyle(document.body).getPropertyValue('--color-warning').trim() || "#f59e0b"
                    ],
                    data: [40, 20, 80, 10],
                  },
                ],
              }}
            />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Pie Chart <DocsLink name="chart" />{' '}
          </CCardHeader>
          <CCardBody>
            <CChartPie
              data={{
                labels: ['Red', 'Green', 'Yellow'],
                datasets: [
                  {
                    data: [300, 50, 100],
                    backgroundColor: [
                      getComputedStyle(document.body).getPropertyValue('--color-danger').trim() || "#ef4444",
                      getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || "#3b82f6",
                      getComputedStyle(document.body).getPropertyValue('--color-warning').trim() || "#f59e0b"
                    ],
                    hoverBackgroundColor: [
                      getComputedStyle(document.body).getPropertyValue('--color-danger').trim() || "#ef4444",
                      getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || "#3b82f6",
                      getComputedStyle(document.body).getPropertyValue('--color-warning').trim() || "#f59e0b"
                    ],
                  },
                ],
              }}
            />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Polar Area Chart
            <DocsLink name="chart" />
          </CCardHeader>
          <CCardBody>
            <CChartPolarArea
              data={{
                labels: ['Red', 'Green', 'Yellow', 'Grey', 'Blue'],
                datasets: [
                  {
                    data: [11, 16, 7, 3, 14],
                    backgroundColor: [
                      getComputedStyle(document.body).getPropertyValue('--color-danger').trim() || "#ef4444",
                      getComputedStyle(document.body).getPropertyValue('--color-info').trim() || "#06b6d4",
                      getComputedStyle(document.body).getPropertyValue('--color-warning').trim() || "#f59e0b",
                      getComputedStyle(document.body).getPropertyValue('--color-muted-light').trim() || "#64748b",
                      getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || "#3b82f6"
                    ],
                  },
                ],
              }}
            />
          </CCardBody>
        </CCard>
      </CCol>
      <CCol xs={6}>
        <CCard className="mb-4">
          <CCardHeader>
            Radar Chart <DocsLink name="chart" />
          </CCardHeader>
          <CCardBody>
            <CChartRadar
              data={{
                labels: [
                  'Eating',
                  'Drinking',
                  'Sleeping',
                  'Designing',
                  'Coding',
                  'Cycling',
                  'Running',
                ],
                datasets: [
                  {
                    label: 'My First dataset',
                    backgroundColor: 'rgba(220, 220, 220, 0.2)',
                    borderColor: 'rgba(220, 220, 220, 1)',
                    pointBackgroundColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointBorderColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointHighlightFill: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointHighlightStroke: 'rgba(220, 220, 220, 1)',
                    data: [65, 59, 90, 81, 56, 55, 40],
                  },
                  {
                    label: 'My Second dataset',
                    backgroundColor: 'rgba(151, 187, 205, 0.2)',
                    borderColor: 'rgba(151, 187, 205, 1)',
                    pointBackgroundColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointBorderColor: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointHighlightFill: getComputedStyle(document.body).getPropertyValue('--color-card-light').trim() || "#ffffff",
                    pointHighlightStroke: 'rgba(151, 187, 205, 1)',
                    data: [28, 48, 40, 19, 96, 27, 100],
                  },
                ],
              }}
            />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Charts
