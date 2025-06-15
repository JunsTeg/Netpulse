"use client"

import { useState, useEffect, useRef } from "react"
import * as d3 from "d3"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CButtonGroup,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CFormInput,
  CProgress,
  CTooltip,
  CBadge,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from "@coreui/react"
import CIcon from "@coreui/icons-react"
import {
  cilZoomIn,
  cilZoomOut,
  cilReload,
  cilFilter,
  cilFullscreen,
  cilDevices,
  cilRouter,
  cilStorage,
  cilSignalCellular4,
  cilMonitor,
  cilScreenDesktop,
  cilInfo,
  cilX,
  cilLan,
} from "@coreui/icons"
import "@coreui/coreui/dist/css/coreui.min.css"
import "./Topology.css"
import axios from 'axios'

// Ajout des styles pour le thème
const themeStyles = {
  card: {
    backgroundColor: 'var(--cui-card-bg)',
    color: 'var(--cui-card-color)',
  },
  header: {
    backgroundColor: 'var(--cui-card-cap-bg)',
    color: 'var(--cui-card-cap-color)',
  },
  text: {
    color: 'var(--cui-body-color)',
  },
  muted: {
    color: 'var(--cui-body-color-secondary)',
  },
  border: {
    borderColor: 'var(--cui-border-color)',
  },
  background: {
    backgroundColor: 'var(--cui-body-bg)',
  }
}

const Topology = () => {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [selectedView, setSelectedView] = useState("physical")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)
  const [simulation, setSimulation] = useState(null)
  const [filteredNodes, setFilteredNodes] = useState([])
  const [filteredLinks, setFilteredLinks] = useState([])
  const [showDetails, setShowDetails] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const searchInputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const zoomBehaviorRef = useRef(null) // Reference pour le comportement de zoom
  const [networkData, setNetworkData] = useState({
    nodes: [],
    links: []
  })
  const [error, setError] = useState(null)

  // Fonction pour generer les suggestions
  const generateSuggestions = (term) => {
    if (!term || !networkData.nodes) {
      setSuggestions([])
      return
    }

    const searchLower = term.toLowerCase()
    const uniqueSuggestions = new Set()

    // Rechercher dans les noms d'appareils
    networkData.nodes.forEach(node => {
      if (node.hostname.toLowerCase().includes(searchLower)) {
        uniqueSuggestions.add({
          type: 'hostname',
          value: node.hostname,
          icon: getDeviceIcon(node.deviceType),
          deviceType: node.deviceType
        })
      }
    })

    // Rechercher dans les types d'appareils
    const deviceTypes = [...new Set(networkData.nodes.map(node => node.deviceType))]
    deviceTypes.forEach(type => {
      if (type.toLowerCase().includes(searchLower)) {
        uniqueSuggestions.add({
          type: 'deviceType',
          value: type,
          icon: getDeviceIcon(type),
          deviceType: type
        })
      }
    })

    // Rechercher dans les VLANs
    const vlans = [...new Set(networkData.nodes.map(node => node.stats.vlan))]
    vlans.forEach(vlan => {
      if (vlan.toLowerCase().includes(searchLower)) {
        uniqueSuggestions.add({
          type: 'vlan',
          value: vlan,
          icon: { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" }
        })
      }
    })

    setSuggestions(Array.from(uniqueSuggestions))
  }

  // Gestionnaire de changement de recherche
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    generateSuggestions(value)
    setShowSuggestions(true)
  }

  // Gestionnaire de selection de suggestion
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.value)
    setShowSuggestions(false)
    filterNetworkData(selectedView, suggestion.value)
  }

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fonction pour reinitialiser la recherche
  const resetSearch = () => {
    setSearchTerm("")
    setSuggestions([])
    setShowSuggestions(false)
    filterNetworkData(selectedView, "")
  }

  // Fonction pour charger la topologie depuis l'API
  const fetchTopology = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/network/topology')
      if (response.data) {
        // Transformer les données de l'API en format attendu par le composant
        const transformedData = {
          nodes: response.data.nodes.map(node => ({
            id: node.id,
            hostname: node.hostname,
            ipAddress: node.ipAddress,
            macAddress: node.macAddress,
            os: node.os,
            deviceType: node.deviceType.toLowerCase(),
            stats: {
              status: node.stats.status,
              vlan: node.stats.vlan,
              bandwidth: node.stats.bandwidth,
              cpuUsage: node.stats.cpuUsage,
              memoryUsage: node.stats.memoryUsage
            },
            lastSeen: node.lastSeen,
            firstDiscovered: node.firstDiscovered
          })),
          links: response.data.links.map(link => ({
            source: link.source,
            target: link.target,
            type: link.type,
            bandwidth: link.bandwidth
          }))
        }
        setNetworkData(transformedData)
        filterNetworkData(selectedView)
      }
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement de la topologie: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Charger la topologie au montage
  useEffect(() => {
    fetchTopology()
  }, [])

  // Fonction pour rafraîchir le graphe
  const refreshGraph = async () => {
    try {
      setLoading(true)
      // Lancer un nouveau scan réseau
      await axios.post('/api/network/scan', { target: '192.168.1.0/24' })
      // Recharger la topologie
      await fetchTopology()
      // Réinitialiser la simulation
      if (simulation) {
        simulation.stop()
      }
      // Réinitialiser le zoom
      if (zoomBehaviorRef.current) {
        d3.select(svgRef.current)
          .transition()
          .duration(750)
          .call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
      }
    } catch (err) {
      setError('Erreur lors du rafraîchissement: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour zoomer
  const handleZoom = (factor) => {
    if (zoomBehaviorRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current)
      const currentTransform = d3.zoomTransform(svg.node())
      
      // Calculer le nouveau niveau de zoom
      const newScale = Math.max(0.1, Math.min(4, currentTransform.k * factor))
      
      // Calculer le centre du SVG
      const width = svgRef.current.clientWidth
      const height = svgRef.current.clientHeight
      const centerX = width / 2
      const centerY = height / 2
      
      // Appliquer la nouvelle transformation
      svg.transition()
        .duration(250)
        .call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(newScale)
            .translate(-centerX, -centerY)
        )
    }
  }

  // Simuler le chargement des donnees
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Fonction pour obtenir la couleur selon le statut
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#2eb85c" // success (vert)
      case "warning":
        return "#f9b115" // warning (orange)
      case "danger":
        return "#e55353" // danger (rouge)
      case "inactive":
        return "#8a93a2" // secondary (gris)
      default:
        return "#8a93a2" // secondary (gris)
    }
  }

  // Fonction pour obtenir l'icone selon le type d'appareil
  const getDeviceIcon = (deviceType) => {
    // Si c'est un nœud VLAN, on retourne l'icône VLAN
    if (deviceType === "vlan") {
      return { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" }
    }

    // Pour les autres types d'appareils
    switch (deviceType?.toLowerCase()) {
      case "router":
        return { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" }
      case "switch":
        return { path: "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" }
      case "server":
        return { path: "M4 1h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2zm0 2v4h16V3H4zm0 7h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zm0 2v4h16v-4H4zm0 7h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zm0 2v4h16v-4H4z" }
      case "ap":
        return { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" }
      case "laptop":
        return { path: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" }
      case "desktop":
        return { path: "M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z" }
      case "mobile":
        return { path: "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" }
      default:
        return { path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" }
    }
  }

  // Fonction pour filtrer les nœuds et liens selon la vue
  const filterNetworkData = (view, searchValue = searchTerm) => {
    if (!networkData || !networkData.nodes || !networkData.links) {
      setFilteredNodes([])
      setFilteredLinks([])
      return
    }

    // On commence avec une copie profonde des données
    let nodes = JSON.parse(JSON.stringify(networkData.nodes))
    let links = JSON.parse(JSON.stringify(networkData.links))

    // On arrete la simulation existante si elle existe
    if (simulation) {
      simulation.stop()
      setSimulation(null)
    }

    switch (view) {
      case "physical":
        // Vue physique : tous les équipements sont visibles
        // Pas de filtrage nécessaire
        break

      case "logical":
        // Vue logique : on ne montre que les équipements réseau
        const networkDevices = ["router", "switch", "ap"]
        nodes = nodes.filter(node => 
          networkDevices.includes(node.deviceType.toLowerCase())
        )
        
        // On filtre les liens pour ne garder que ceux entre équipements réseau
        const validNodeIds = new Set(nodes.map(n => n.id))
        links = links.filter(link => 
          validNodeIds.has(link.source) && validNodeIds.has(link.target)
        )
        break

      case "vlan":
        // Vue VLAN : on groupe les équipements par VLAN
        const vlanGroups = {}
        
        // On crée d'abord les groupes VLAN
        nodes.forEach(node => {
          const vlan = node.stats.vlan
          if (!vlanGroups[vlan]) {
            vlanGroups[vlan] = {
              id: `vlan-${vlan}`,
              type: "vlan",
              hostname: `VLAN ${vlan}`,
              stats: {
                status: "active",
                vlan: vlan
              },
              devices: []
            }
          }
          vlanGroups[vlan].devices.push(node)
        })

        // On remplace les nœuds par les groupes VLAN
        nodes = Object.values(vlanGroups)

        // On crée les liens entre VLANs
        const vlanConnections = new Map()
        networkData.links.forEach(link => {
          const sourceNode = networkData.nodes.find(n => n.id === link.source)
          const targetNode = networkData.nodes.find(n => n.id === link.target)
          
          if (sourceNode && targetNode && sourceNode.stats.vlan !== targetNode.stats.vlan) {
            const vlanPair = [sourceNode.stats.vlan, targetNode.stats.vlan].sort()
            const key = vlanPair.join('-')
            
            if (!vlanConnections.has(key)) {
              vlanConnections.set(key, {
                source: `vlan-${vlanPair[0]}`,
                target: `vlan-${vlanPair[1]}`,
                type: "vlan",
                bandwidth: "1Gbps"
              })
            }
          }
        })
        
        links = Array.from(vlanConnections.values())
        break

      default:
        break
    }

    // Application du filtre de recherche si nécessaire
    if (searchValue) {
      const searchLower = searchValue.toLowerCase()
      const searchableNodes = nodes.filter(node => {
        if (node.type === "vlan") {
          return node.hostname.toLowerCase().includes(searchLower) ||
                 node.stats.vlan.toLowerCase().includes(searchLower)
        }
        return node.hostname.toLowerCase().includes(searchLower) ||
               node.deviceType.toLowerCase().includes(searchLower) ||
               (node.stats && node.stats.vlan.toLowerCase().includes(searchLower))
      })

      // On garde les IDs des nœuds filtrés
      const validNodeIds = new Set(searchableNodes.map(n => n.id))
      
      // On filtre les liens en conséquence
      const filteredLinks = links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source
        const targetId = typeof link.target === 'object' ? link.target.id : link.target
        return validNodeIds.has(sourceId) && validNodeIds.has(targetId)
      })

      nodes = searchableNodes
      links = filteredLinks
    }

    // On met à jour les états avec les nouvelles données filtrées
    setFilteredNodes(nodes)
    setFilteredLinks(links)
  }

  // Mettre à jour les filtres quand la vue ou la recherche change
  useEffect(() => {
    filterNetworkData(selectedView)
  }, [selectedView, searchTerm])

  // Initialisation du graphique D3
  useEffect(() => {
    if (!svgRef.current || loading) return

    // Nettoyage du SVG existant
    d3.select(svgRef.current).selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Creation du groupe principal
    const g = d3.select(svgRef.current)
      .append("g")
      .attr("class", "topology-container")

    // Creation de la simulation de force avec les nouvelles données
    const sim = d3.forceSimulation(filteredNodes)
      .force(
        "link",
        d3.forceLink(filteredLinks)
          .id(d => d.id)
          .distance(selectedView === "vlan" ? 200 : 100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(selectedView === "vlan" ? 80 : 50))

    // On stocke la nouvelle simulation
    setSimulation(sim)

    // Creation des liens
    const link = g
      .append("g")
      .selectAll("line")
      .data(filteredLinks)
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "#6c757d")
      .style("stroke-width", 2)
      .style("stroke-dasharray", (d) => (d.type === "wifi" ? "5,5" : d.type === "vlan" ? "10,5" : "0"))

    // Creation des noeuds
    const node = g
      .append("g")
      .selectAll(".node")
      .data(filteredNodes)
      .enter()
      .append("g")
      .attr("class", (d) => `node ${d.deviceType}`)

    // Ajout des cercles pour les noeuds
    const circles = node
      .append("circle")
      .attr("r", (d) => (d.deviceType === "vlan" ? 40 : 25))
      .style("fill", (d) => getStatusColor(d.stats.status))
      .style("stroke-width", "2px")
      .style("stroke", "#ffffff")
      .style("cursor", "pointer")

    // Gestion du clic sur les cercles
    circles.on("mousedown", function(event, d) {
      event.stopPropagation()
      const connectedLinks = getConnectedLinks(d.id)
      const connectedNodes = getConnectedNodes(d.id)
      setSelectedNode({
        ...d,
        connectedLinks,
        connectedNodes
      })
    })

    // Configuration du zoom
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
        setZoom(event.transform.k)
      })

    // Sauvegarder la reference du comportement de zoom
    zoomBehaviorRef.current = zoomBehavior

    d3.select(svgRef.current).call(zoomBehavior)

    // Ajout du drag
    node.call(
      d3.drag()
        .on("start", (event, d) => {
          event.sourceEvent.stopPropagation()
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event, d) => {
          event.sourceEvent.stopPropagation()
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event, d) => {
          event.sourceEvent.stopPropagation()
          if (!event.active) sim.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
    )

    // Ajout des icones
    node
      .append("g")
      .attr("class", "node-icon-container")
      .style("pointer-events", "none")
      .append("foreignObject")
      .attr("width", (d) => (d.type === "vlan" ? 60 : 40))
      .attr("height", (d) => (d.type === "vlan" ? 60 : 40))
      .attr("x", (d) => (d.type === "vlan" ? -30 : -20))
      .attr("y", (d) => (d.type === "vlan" ? -30 : -20))
      .append("xhtml:div")
      .style("width", "100%")
      .style("height", "100%")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .html((d) => {
        if (d.type === "vlan") {
          return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; color: white; font-weight: bold;">
            <span>VLAN</span>
            <span>${d.stats.vlan}</span>
            <span style="font-size: 0.8em;">(${d.devices.length} appareils)</span>
          </div>`
        }
        const icon = getDeviceIcon(d.deviceType)
        return `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="${icon.path}" fill="#ffffff"/>
          </svg>
        </div>`
      })

    // Ajout des labels
    node
      .append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => (d.deviceType === "vlan" ? 55 : 40))
      .attr("text-anchor", "middle")
      .text((d) => d.hostname)
      .style("font-size", (d) => (d.deviceType === "vlan" ? "14px" : "12px"))
      .style("fill", "#666")
      .style("pointer-events", "none") // On desactive les evenements sur le label

    // Gestionnaire de clic sur le SVG pour fermer le panneau
    d3.select(svgRef.current)
      .on("click", (event) => {
        // On ferme le panneau uniquement si on clique sur le fond
        if (event.target === svgRef.current || event.target.tagName === 'svg') {
          setSelectedNode(null)
        }
      })

    // Mise a jour de la simulation
    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    // Nettoyage amélioré
    return () => {
      if (sim) {
        sim.stop()
      }
      d3.select(svgRef.current).selectAll("*").remove()
    }
  }, [loading, selectedView, filteredNodes, filteredLinks])

  // Fonction pour obtenir les liens connectés à un nœud
  const getConnectedLinks = (nodeId) => {
    return filteredLinks.filter(link => 
      link.source.id === nodeId || link.target.id === nodeId ||
      link.source === nodeId || link.target === nodeId
    )
  }

  // Fonction pour obtenir les nœuds connectés
  const getConnectedNodes = (nodeId) => {
    const links = getConnectedLinks(nodeId)
    return links.map(link => {
      const connectedId = link.source.id === nodeId || link.source === nodeId ? link.target : link.source
      return filteredNodes.find(n => n.id === connectedId || n.id === `vlan-${connectedId}`)
    }).filter(Boolean)
  }

  // Fonction pour formater la bande passante
  const formatBandwidth = (bandwidth) => {
    return bandwidth.replace('bps', 'bits/s')
  }

  return (
    <>
      <CCard className="mb-4 topology-card" style={themeStyles.card}>
        <CCardHeader className="topology-header" style={themeStyles.header}>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0" style={themeStyles.text}>Topologie du Réseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButtonGroup>
                <CTooltip content="Zoom avant">
                  <CButton color="primary" variant="outline" onClick={() => handleZoom(1.2)}>
                    <CIcon icon={cilZoomIn} />
                  </CButton>
                </CTooltip>
                <CTooltip content="Zoom arrière">
                  <CButton
                    color="primary"
                    variant="outline"
                    onClick={() => handleZoom(0.8)}
                  >
                    <CIcon icon={cilZoomOut} />
                  </CButton>
                </CTooltip>
                <CTooltip content="Actualiser">
                  <CButton color="primary" variant="outline" onClick={refreshGraph}>
                    <CIcon icon={cilReload} />
                  </CButton>
                </CTooltip>
                <CTooltip content="Plein écran">
                  <CButton
                    color="primary"
                    variant="outline"
                    onClick={() => document.documentElement.requestFullscreen()}
                  >
                    <CIcon icon={cilFullscreen} />
                  </CButton>
                </CTooltip>
              </CButtonGroup>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody style={themeStyles.background}>
          <CRow className="mb-3">
            <CCol md={5}>
              <div className="d-flex flex-column">
                <CButtonGroup className="view-selector">
                  <CTooltip content="Vue Physique - Tous les équipements">
                    <CButton
                      color={selectedView === "physical" ? "primary" : "secondary"}
                      variant={selectedView === "physical" ? "solid" : "outline"}
                      onClick={() => setSelectedView("physical")}
                      className="d-flex align-items-center justify-content-center gap-2 px-3"
                    >
                      <CIcon icon={cilDevices} size="sm" />
                      <span>Physique</span>
                    </CButton>
                  </CTooltip>
                  <CTooltip content="Vue Logique - Équipements réseau uniquement">
                    <CButton
                      color={selectedView === "logical" ? "primary" : "secondary"}
                      variant={selectedView === "logical" ? "solid" : "outline"}
                      onClick={() => setSelectedView("logical")}
                      className="d-flex align-items-center justify-content-center gap-2 px-3"
                    >
                      <CIcon icon={cilLan} size="sm" />
                      <span>Logique</span>
                    </CButton>
                  </CTooltip>
                  <CTooltip content="Vue par VLAN - Groupement par VLAN">
                    <CButton
                      color={selectedView === "vlan" ? "primary" : "secondary"}
                      variant={selectedView === "vlan" ? "solid" : "outline"}
                      onClick={() => setSelectedView("vlan")}
                      className="d-flex align-items-center justify-content-center gap-2 px-3"
                    >
                      <CIcon icon={cilSignalCellular4} size="sm" />
                      <span>VLAN</span>
                    </CButton>
                  </CTooltip>
                </CButtonGroup>
              </div>
            </CCol>
            <CCol md={6} className="position-relative" ref={searchInputRef}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilFilter} />
                </CInputGroupText>
                <CFormInput
                  placeholder="Rechercher un appareil, type ou VLAN..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => setShowSuggestions(true)}
                  className="topology-search"
                />
                {searchTerm && (
                  <CInputGroupText 
                    style={{ cursor: 'pointer' }}
                    onClick={resetSearch}
                    className="bg-transparent border-start-0"
                  >
                    <CIcon 
                      icon={cilX} 
                      style={{ 
                        color: '#666',
                        transition: 'color 0.2s',
                        ':hover': {
                          color: '#333'
                        }
                      }}
                    />
                  </CInputGroupText>
                )}
              </CInputGroup>
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="suggestions-container"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderBottom: index < suggestions.length - 1 ? '1px solid #eee' : 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d={suggestion.icon.path} fill="#666"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{suggestion.value}</div>
                        <small style={{ color: '#666' }}>
                          {suggestion.type === 'hostname' ? `Appareil (${suggestion.deviceType})` :
                           suggestion.type === 'deviceType' ? 'Type d\'appareil' :
                           'VLAN'}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CCol>
          </CRow>

          {loading ? (
            <div className="text-center py-5">
              <CProgress animated value={100} className="mb-3" />
              <p>Chargement de la topologie...</p>
            </div>
          ) : (
            <div className="topology-container" style={themeStyles.background}>
              <svg ref={svgRef} width="100%" height="600px" className="topology-svg" style={themeStyles.background} />

              {selectedNode && (
                <div className="node-details-panel" style={{...themeStyles.card, ...themeStyles.border}}>
                  <div className="node-details-header d-flex justify-content-between align-items-center p-2 border-bottom" style={themeStyles.header}>
                    <div className="d-flex align-items-center">
                      <CIcon 
                        icon={
                          selectedNode.type === "vlan" ? cilSignalCellular4 :
                          selectedNode.deviceType === "router" ? cilRouter :
                          selectedNode.deviceType === "switch" ? cilStorage :
                          selectedNode.deviceType === "server" ? cilDevices :
                          selectedNode.deviceType === "ap" ? cilSignalCellular4 :
                          selectedNode.deviceType === "laptop" ? cilMonitor :
                          selectedNode.deviceType === "desktop" ? cilScreenDesktop :
                          cilDevices
                        }
                        className="me-2"
                        size="xl"
                      />
                      <div>
                        <h6 className="mb-0">{selectedNode.hostname}</h6>
                        <small className="text-muted">{selectedNode.deviceType}</small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <CBadge
                        color={
                          getStatusColor(selectedNode.stats.status) === "#2eb85c"
                            ? "success"
                            : getStatusColor(selectedNode.stats.status) === "#f9b115"
                              ? "warning"
                              : getStatusColor(selectedNode.stats.status) === "#e55353"
                                ? "danger"
                                : "secondary"
                        }
                        className="me-2"
                      >
                        {selectedNode.stats.status}
                      </CBadge>
                      <CButton
                        color="link"
                        className="close-button p-0"
                        onClick={() => setSelectedNode(null)}
                      >
                        <CIcon icon={cilInfo} size="lg" />
                      </CButton>
                    </div>
                  </div>

                  <div className="node-details-content" style={themeStyles.background}>
                    {selectedNode.type === "vlan" ? (
                      <>
                        <div className="mb-3">
                          <strong>Statut:</strong>
                          <CBadge
                            color={
                              getStatusColor(selectedNode.status) === "#2eb85c"
                                ? "success"
                                : getStatusColor(selectedNode.status) === "#f9b115"
                                  ? "warning"
                                  : getStatusColor(selectedNode.status) === "#e55353"
                                    ? "danger"
                                    : "secondary"
                            }
                            className="ms-2"
                          >
                            {selectedNode.status}
                          </CBadge>
                        </div>
                        <div className="mb-3">
                          <strong>Nombre d'appareils:</strong> {selectedNode.devices?.length || 0}
                        </div>
                        {selectedNode.devices && (
                          <div className="mb-3">
                            <strong>Appareils connectés:</strong>
                            <ul className="list-unstyled mt-2">
                              {selectedNode.devices.map((device, index) => (
                                <li key={index} className="mb-2">
                                  <div className="d-flex align-items-center">
                                    <CIcon 
                                      icon={
                                        device.deviceType === "router" ? cilRouter :
                                        device.deviceType === "switch" ? cilStorage :
                                        device.deviceType === "server" ? cilDevices :
                                        device.deviceType === "ap" ? cilSignalCellular4 :
                                        device.deviceType === "laptop" ? cilMonitor :
                                        device.deviceType === "desktop" ? cilScreenDesktop :
                                        cilDevices
                                      }
                                      className="me-2"
                                    />
                                    <span>{device.hostname}</span>
                                    <CBadge
                                      color={
                                        getStatusColor(device.status) === "#2eb85c"
                                          ? "success"
                                          : getStatusColor(device.status) === "#f9b115"
                                            ? "warning"
                                            : getStatusColor(device.status) === "#e55353"
                                              ? "danger"
                                              : "secondary"
                                      }
                                      className="ms-2"
                                    >
                                      {device.status}
                                    </CBadge>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedNode.connectedLinks && selectedNode.connectedLinks.length > 0 && (
                          <div className="mb-3">
                            <strong>Connexions avec autres VLANs:</strong>
                            <ul className="list-unstyled mt-2">
                              {selectedNode.connectedNodes.map((node, index) => {
                                if (node.deviceType === "vlan") {
                                  return (
                                    <li key={index} className="mb-2">
                                      <div className="d-flex align-items-center">
                                        <span>VLAN {node.stats.vlan}</span>
                                        <CBadge color="info" className="ms-2">
                                          {selectedNode.connectedLinks[index].bandwidth}
                                        </CBadge>
                                      </div>
                                    </li>
                                  )
                                }
                                return null
                              })}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <CNav variant="tabs" className="px-2 pt-2">
                          <CNavItem>
                            <CNavLink
                              active={activeTab === 'overview'}
                              onClick={() => setActiveTab('overview')}
                            >
                              Vue d'ensemble
                            </CNavLink>
                          </CNavItem>
                          <CNavItem>
                            <CNavLink
                              active={activeTab === 'system'}
                              onClick={() => setActiveTab('system')}
                            >
                              Système
                            </CNavLink>
                          </CNavItem>
                          <CNavItem>
                            <CNavLink
                              active={activeTab === 'network'}
                              onClick={() => setActiveTab('network')}
                            >
                              Réseau
                            </CNavLink>
                          </CNavItem>
                        </CNav>

                        <CTabContent className="p-2">
                          <CTabPane visible={activeTab === 'overview'}>
                            <div className="row g-2">
                              <div className="col-6">
                                <small className="text-muted d-block" style={themeStyles.muted}>IP</small>
                                <span style={themeStyles.text}>{selectedNode.ipAddress}</span>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block" style={themeStyles.muted}>VLAN</small>
                                <span style={themeStyles.text}>{selectedNode.stats.vlan}</span>
                              </div>
                              <div className="col-12 mt-2">
                                <small className="text-muted d-block" style={themeStyles.muted}>CPU</small>
                                <div className="d-flex align-items-center">
                                  <div className="flex-grow-1 me-2">
                                    <CProgress 
                                      value={selectedNode.stats.cpuUsage} 
                                      color={
                                        selectedNode.stats.cpuUsage > 80 ? "danger" :
                                        selectedNode.stats.cpuUsage > 60 ? "warning" :
                                        "success"
                                      }
                                      className="mb-1"
                                    />
                                  </div>
                                  <small style={themeStyles.text}>{selectedNode.stats.cpuUsage}%</small>
                                </div>
                              </div>
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Mémoire</small>
                                <div className="d-flex align-items-center">
                                  <div className="flex-grow-1 me-2">
                                    <CProgress 
                                      value={selectedNode.stats.memoryUsage} 
                                      color={
                                        selectedNode.stats.memoryUsage > 80 ? "danger" :
                                        selectedNode.stats.memoryUsage > 60 ? "warning" :
                                        "success"
                                      }
                                      className="mb-1"
                                    />
                                  </div>
                                  <small style={themeStyles.text}>{selectedNode.stats.memoryUsage}%</small>
                                </div>
                              </div>
                              {selectedNode.connectedLinks && selectedNode.connectedLinks.length > 0 && (
                                <div className="col-12 mt-2">
                                  <small className="text-muted d-block" style={themeStyles.muted}>Connexions actives</small>
                                  <div className="list-group list-group-flush">
                                    {selectedNode.connectedLinks.slice(0, 3).map((link, index) => {
                                      const connectedNode = selectedNode.connectedNodes[index]
                                      return (
                                        <div key={index} className="list-group-item px-0 py-1">
                                          <div className="d-flex align-items-center">
                                            <CIcon 
                                              icon={
                                                connectedNode?.deviceType === "router" ? cilRouter :
                                                connectedNode?.deviceType === "switch" ? cilStorage :
                                                connectedNode?.deviceType === "server" ? cilDevices :
                                                connectedNode?.deviceType === "ap" ? cilSignalCellular4 :
                                                connectedNode?.deviceType === "laptop" ? cilMonitor :
                                                connectedNode?.deviceType === "desktop" ? cilScreenDesktop :
                                                connectedNode?.type === "vlan" ? cilSignalCellular4 :
                                                cilDevices
                                              }
                                              className="me-2"
                                              size="sm"
                                            />
                                            <span className="text-truncate" style={themeStyles.text}>
                                              {connectedNode?.type === "vlan" 
                                                ? `VLAN ${connectedNode.vlan}`
                                                : connectedNode?.hostname || "Inconnu"}
                                            </span>
                                            <CBadge color="info" className="ms-auto">
                                              {link.bandwidth}
                                            </CBadge>
                                          </div>
                                        </div>
                                      )
                                    })}
                                    {selectedNode.connectedLinks.length > 3 && (
                                      <div className="text-center text-muted small mt-1">
                                        +{selectedNode.connectedLinks.length - 3} autres connexions
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CTabPane>

                          <CTabPane visible={activeTab === 'system'}>
                            <div className="row g-2">
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Système d'exploitation</small>
                                <span style={themeStyles.text}>{selectedNode.os}</span>
                              </div>
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Dernière vue</small>
                                <span style={themeStyles.text}>{new Date(selectedNode.lastSeen).toLocaleString()}</span>
                              </div>
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Première découverte</small>
                                <span style={themeStyles.text}>{new Date(selectedNode.firstDiscovered).toLocaleString()}</span>
                              </div>
                            </div>
                          </CTabPane>

                          <CTabPane visible={activeTab === 'network'}>
                            <div className="row g-2">
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Adresse MAC</small>
                                <span style={themeStyles.text}>{selectedNode.macAddress}</span>
                              </div>
                              <div className="col-12">
                                <small className="text-muted d-block" style={themeStyles.muted}>Bande passante</small>
                                <span style={themeStyles.text}>{selectedNode.stats.bandwidth}</span>
                              </div>
                              {selectedNode.connectedLinks && selectedNode.connectedLinks.length > 0 && (
                                <div className="col-12">
                                  <small className="text-muted d-block" style={themeStyles.muted}>Toutes les connexions</small>
                                  <div className="list-group list-group-flush">
                                    {selectedNode.connectedLinks.map((link, index) => {
                                      const connectedNode = selectedNode.connectedNodes[index]
                                      return (
                                        <div key={index} className="list-group-item px-0 py-1">
                                          <div className="d-flex align-items-center">
                                            <CIcon 
                                              icon={
                                                connectedNode?.deviceType === "router" ? cilRouter :
                                                connectedNode?.deviceType === "switch" ? cilStorage :
                                                connectedNode?.deviceType === "server" ? cilDevices :
                                                connectedNode?.deviceType === "ap" ? cilSignalCellular4 :
                                                connectedNode?.deviceType === "laptop" ? cilMonitor :
                                                connectedNode?.deviceType === "desktop" ? cilScreenDesktop :
                                                connectedNode?.type === "vlan" ? cilSignalCellular4 :
                                                cilDevices
                                              }
                                              className="me-2"
                                              size="sm"
                                            />
                                            <div className="flex-grow-1">
                                              <div className="d-flex align-items-center">
                                                <span className="text-truncate" style={themeStyles.text}>
                                                  {connectedNode?.type === "vlan" 
                                                    ? `VLAN ${connectedNode.vlan}`
                                                    : connectedNode?.hostname || "Inconnu"}
                                                </span>
                                                <CBadge color="info" className="ms-2">
                                                  {link.bandwidth}
                                                </CBadge>
                                                {link.type && (
                                                  <CBadge color="secondary" className="ms-2">
                                                    {link.type}
                                                  </CBadge>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CTabPane>
                        </CTabContent>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 topology-legend" style={themeStyles.background}>
            <h6 style={themeStyles.text}>
              <CIcon icon={cilInfo} className="me-2" />
              Légende :
            </h6>
            <div className="d-flex flex-wrap">
              <div className="legend-item">
                <div className="legend-icon router">
                  <CIcon icon={cilRouter} />
                </div>
                <span style={themeStyles.text}>Router</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon switch">
                  <CIcon icon={cilStorage} />
                </div>
                <span style={themeStyles.text}>Switch</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon server">
                  <CIcon icon={cilDevices} />
                </div>
                <span style={themeStyles.text}>Serveur</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon ap">
                  <CIcon icon={cilSignalCellular4} />
                </div>
                <span style={themeStyles.text}>Point d'accès</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon laptop">
                  <CIcon icon={cilMonitor} />
                </div>
                <span style={themeStyles.text}>Portable</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon desktop">
                  <CIcon icon={cilScreenDesktop} />
                </div>
                <span style={themeStyles.text}>Ordinateur fixe</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon mobile">
                  <CIcon icon={cilDevices} />
                </div>
                <span style={themeStyles.text}>Mobile</span>
              </div>
            </div>
            <div className="d-flex flex-wrap mt-2">
              <div className="legend-status">
                <div className="legend-status-dot active"></div>
                <span style={themeStyles.text}>Actif</span>
              </div>
              <div className="legend-status">
                <div className="legend-status-dot warning"></div>
                <span style={themeStyles.text}>Avertissement</span>
              </div>
              <div className="legend-status">
                <div className="legend-status-dot danger"></div>
                <span style={themeStyles.text}>Danger</span>
              </div>
              <div className="legend-status">
                <div className="legend-status-dot inactive"></div>
                <span style={themeStyles.text}>Inactif</span>
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Topology
